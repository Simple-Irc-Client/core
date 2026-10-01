/**
 * SIC-E2EE v1 — handshake state machine and message sealing.
 *
 *   key exchange      ECDH, curve P-256                        (crypto.ts)
 *   key derivation    HKDF-SHA256                               (crypto.ts)
 *   cipher            AES-256-GCM                               (crypto.ts)
 *   library           browser WebCrypto only, no 3rd-party crypto
 *
 *   encrypted         body of a 1:1 message, or a /me action
 *   never encrypted   channel messages — no group mode exists
 *   not hidden        who talks to whom, and when — IRC exposes that already
 *   not hidden        roughly how long a message is (chunk count shows)
 *
 *   trust model       TOFU: first key seen is trusted           (store/pins.ts)
 *                     a later, different key blocks the session, not silently
 *   verified by       comparing fingerprints out of band         (shown in UI)
 *
 *   forward secrecy   per handshake, not per message — no ratchet
 *   key storage       identity private key is non-extractable    (identity.ts)
 *   abuse handling    rate-limited handshakes                    (rateLimit.ts)
 *   abuse handling    one message capped at 16 chunks             (protocol.ts)
 *
 * All key material lives in this module's unserialised map; the zustand store holds only what the UI renders.
 *
 * Handshake, from the initiator's side:
 *
 *   offerEncryption()  ──OFFER(PRIVMSG)──▶            state: offered
 *                      ◀─ACCEPT(NOTICE)──   pin check, derive → state: active
 *                      ◀─DECLINE(NOTICE)─                     → state: declined
 *                      (no reply within OFFER_TIMEOUT_MS)     → state: error
 *                      (a late ACCEPT still completes it from here)
 *
 * A responder's inbound OFFER waits for the user (no auto-accept for an unknown key).
 * Glare (both offer at once): the lower folded nick stays initiator, the higher answers immediately.
 */

import i18next from 'i18next';

import { getAutoOfferEncryption, getCurrentNick, getE2eeEnabled, getLineLenLimit, getServer } from '@/features/settings/store/settings';
import { getUser } from '@/features/users/store/users';
import { ircSendRawMessage } from '@/network/irc/network';

import {
  deriveSessionKeys,
  fingerprintFromB64,
  generateEphemeral,
  importPublicKey,
  open,
  seal,
  type HandshakeRole,
  type Identity,
  type KeyPairWithPublic,
  type SessionKeys,
} from './crypto';
import { getIdentity } from './identity';
import {
  buildAcceptFrame,
  buildCipherFrames,
  buildDeclineFrame,
  buildOfferFrame,
  buildResetFrame,
  chunkCharsFor,
  createReassembler,
  decodeBody,
  encodeBody,
  newFrameId,
  PROTOCOL_VERSION,
  type BodyKind,
  type E2eeFrame,
} from './protocol';
import {
  E2eeState,
  getActiveSessionPeers,
  getSession,
  getSessionKey,
  getSessionState,
  isPlaintextAcknowledged,
  patchSession,
  removeSession,
  setPlaintextAcknowledged,
  setSession,
  clearSessions,
} from './store/e2ee';
import { getPeerKey, getPin, putPin, setPinVerified } from './store/pins';

// Covers the peer's human reaction time (15s was too tight). Only changes the UI: a late ACCEPT still completes
const OFFER_TIMEOUT_MS = 60_000;

/** Our recent frame ids, to drop their echo-message copies. */
const OWN_FRAME_MEMORY = 256;

interface SessionSecrets {
  role: HandshakeRole;
  identity: Identity;
  ephemeral: KeyPairWithPublic;
  /** The peer's keys from an inbound OFFER, held while the user decides. */
  pendingOffer?: { identityKeyB64: string; ephemeralKeyB64: string };
  /** Set once the handshake completes. */
  keys?: SessionKeys;
}

/** Keyed by folded nick. Never persisted, never in the store. */
const secrets = new Map<string, SessionSecrets>();

const offerTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Sent frames render locally, so their echo-message copies are dropped. */
const ownFrameIds = new Set<string>();

const reassembler = createReassembler();

/** Peers with an active session when the connection dropped; re-offered when seen online after reconnect. */
let resumeCandidates = new Set<string>();

const getNetwork = (): string => {
  const network = getServer()?.network;

  return network && network.length > 0 ? network : 'default';
};

/** Account where known, nick otherwise. */
const peerKeyFor = (nick: string): string => getPeerKey(nick, getUser(nick)?.account);

const clearOfferTimer = (key: string): void => {
  const timer = offerTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    offerTimers.delete(key);
  }
};

const CTCP = '\x01';

const sendPrivmsgCtcp = (nick: string, body: string): void => {
  ircSendRawMessage(`PRIVMSG ${nick} :${CTCP}${body}${CTCP}`);
};

const sendNoticeCtcp = (nick: string, body: string): void => {
  ircSendRawMessage(`NOTICE ${nick} :${CTCP}${body}${CTCP}`);
};

const rememberOwnFrame = (frameId: string): void => {
  ownFrameIds.add(frameId);
  if (ownFrameIds.size > OWN_FRAME_MEMORY) {
    const oldest = ownFrameIds.values().next();
    if (!oldest.done) {
      ownFrameIds.delete(oldest.value);
    }
  }
};

const failSession = (nick: string, messageKey: string): void => {
  const key = getSessionKey(nick);
  clearOfferTimer(key);
  secrets.delete(key);
  reassembler.forget(nick);
  setSession(nick, { state: E2eeState.error, verified: false, errorMessage: i18next.t(messageKey) });
};

/**
 * Null when acceptable (unknown or matching); otherwise the pinned fingerprint, for a blocking warning.
 * Compares raw key bytes; the fingerprint is recomputed so old pins never show a stale display format.
 */
const checkPin = async (nick: string, identityKeyB64: string): Promise<{ pinnedFingerprint: string } | null> => {
  const pin = getPin(getNetwork(), peerKeyFor(nick));
  if (!pin || pin.identityKeyB64 === identityKeyB64) {
    return null;
  }

  return { pinnedFingerprint: await fingerprintFromB64(pin.identityKeyB64) };
};

/** Returns whether the pin was already verified. */
const savePin = (nick: string, identityKeyB64: string, fingerprint: string): boolean => {
  const network = getNetwork();
  const peerKey = peerKeyFor(nick);
  const existing = getPin(network, peerKey);

  if (existing && existing.identityKeyB64 === identityKeyB64) {
    return existing.verified;
  }

  putPin(network, peerKey, { identityKeyB64, fingerprint, firstSeen: new Date().toISOString(), verified: false });

  return false;
};

/** Any failure ends as a visible error, never a fallback to plaintext. */
const completeHandshake = async (
  nick: string,
  role: HandshakeRole,
  theirIdentityKeyB64: string,
  theirEphemeralKeyB64: string,
): Promise<void> => {
  const key = getSessionKey(nick);
  const entry = secrets.get(key);
  if (!entry) {
    failSession(nick, 'e2ee.error.noHandshakeInProgress');
    return;
  }

  const theirFingerprint = await fingerprintFromB64(theirIdentityKeyB64);

  const mismatch = await checkPin(nick, theirIdentityKeyB64);
  if (mismatch) {
    clearOfferTimer(key);
    secrets.delete(key);
    sendNoticeCtcp(nick, buildResetFrame());
    setSession(nick, {
      state: E2eeState.fingerprintChanged,
      verified: false,
      myFingerprint: entry.identity.fingerprint,
      theirFingerprint,
      expectedFingerprint: mismatch.pinnedFingerprint,
    });
    return;
  }

  const keys = await deriveSessionKeys({
    role,
    identity: entry.identity,
    ephemeral: entry.ephemeral,
    theirIdentityKeyB64,
    theirEphemeralKeyB64,
  });

  const verified = savePin(nick, theirIdentityKeyB64, theirFingerprint);

  secrets.set(key, { ...entry, role, keys });
  clearOfferTimer(key);

  // An earlier "plaintext is fine" doesn't carry over to the next loss
  setPlaintextAcknowledged(nick, false);

  setSession(nick, {
    state: E2eeState.active,
    verified,
    myFingerprint: entry.identity.fingerprint,
    theirFingerprint,
  });
};

/** A non-SIC peer simply never answers. */
export const offerEncryption = async (nick: string): Promise<void> => {
  // The UI hides these paths too, but this is the one choke point they all share
  if (!getE2eeEnabled()) {
    return;
  }

  const key = getSessionKey(nick);

  if (getSessionState(nick) === E2eeState.active) {
    return;
  }

  try {
    const identity = await getIdentity();
    const ephemeral = await generateEphemeral();

    secrets.set(key, { role: 'initiator', identity, ephemeral });
    setSession(nick, { state: E2eeState.offered, verified: false, myFingerprint: identity.fingerprint });

    sendPrivmsgCtcp(nick, buildOfferFrame(identity.publicKeyB64, ephemeral.publicKeyB64));

    clearOfferTimer(key);
    offerTimers.set(
      key,
      setTimeout(() => {
        offerTimers.delete(key);
        if (getSessionState(nick) === E2eeState.offered) {
          // Keys survive so a late ACCEPT can still complete; only the visible state changes
          setSession(nick, {
            state: E2eeState.error,
            verified: false,
            errorMessage: i18next.t('e2ee.error.noReply', { nick }),
          });
        }
      }, OFFER_TIMEOUT_MS),
    );
  } catch (error) {
    console.warn('E2EE: could not send offer:', error);
    failSession(nick, 'e2ee.error.handshakeFailed');
  }
};

export const acceptIncomingOffer = async (nick: string): Promise<void> => {
  const key = getSessionKey(nick);
  const entry = secrets.get(key);
  const session = getSession(nick);

  if (!entry || session?.state !== E2eeState.incoming || entry.pendingOffer === undefined) {
    return;
  }

  try {
    sendNoticeCtcp(nick, buildAcceptFrame(entry.identity.publicKeyB64, entry.ephemeral.publicKeyB64));
    await completeHandshake(nick, 'responder', entry.pendingOffer.identityKeyB64, entry.pendingOffer.ephemeralKeyB64);
  } catch (error) {
    console.warn('E2EE: could not accept offer:', error);
    failSession(nick, 'e2ee.error.handshakeFailed');
  }
};

/** The peer is told, so their banner resolves. */
export const declineIncomingOffer = (nick: string): void => {
  const key = getSessionKey(nick);
  secrets.delete(key);
  clearOfferTimer(key);
  sendNoticeCtcp(nick, buildDeclineFrame());
  removeSession(nick);
};

const handleOffer = async (nick: string, frame: Extract<E2eeFrame, { type: 'offer' }>): Promise<void> => {
  // Disabled locally: decline silently (the peer still gets a DECLINE)
  if (!getE2eeEnabled()) {
    sendNoticeCtcp(nick, buildDeclineFrame());
    return;
  }

  if (frame.version !== PROTOCOL_VERSION) {
    setSession(nick, {
      state: E2eeState.error,
      verified: false,
      errorMessage: i18next.t('e2ee.error.versionMismatch', { nick }),
    });
    return;
  }

  // Junk keys must produce an error, not a trust prompt
  await importPublicKey(frame.identityKeyB64);
  await importPublicKey(frame.ephemeralKeyB64);

  const key = getSessionKey(nick);
  const previousState = getSessionState(nick);

  // Glare: without a tie-break both would derive from different ephemerals and nothing would decrypt
  const yieldingToGlare = previousState === E2eeState.offered;
  if (yieldingToGlare && getSessionKey(getCurrentNick()) < key) {
    return;
  }

  const theirFingerprint = await fingerprintFromB64(frame.identityKeyB64);
  const identity = await getIdentity();

  const mismatch = await checkPin(nick, frame.identityKeyB64);
  if (mismatch) {
    clearOfferTimer(key);
    secrets.delete(key);
    reassembler.forget(nick);
    setSession(nick, {
      state: E2eeState.fingerprintChanged,
      verified: false,
      myFingerprint: identity.fingerprint,
      theirFingerprint,
      expectedFingerprint: mismatch.pinnedFingerprint,
    });
    return;
  }

  // An OFFER replaces any session outright; its buffered chunks and timer go too
  clearOfferTimer(key);
  reassembler.forget(nick);

  // After the pin check, so a failing peer doesn't cost a keypair per offer
  const ephemeral = await generateEphemeral();

  secrets.set(key, {
    role: 'responder',
    identity,
    ephemeral,
    pendingOffer: { identityKeyB64: frame.identityKeyB64, ephemeralKeyB64: frame.ephemeralKeyB64 },
  });

  setSession(nick, {
    state: E2eeState.incoming,
    verified: false,
    myFingerprint: identity.fingerprint,
    theirFingerprint,
  });

  // Glare yields answer at once (the user already offered). Auto-accept never applies to an unknown key
  const pinnedAndTrusted = getAutoOfferEncryption() && getPin(getNetwork(), peerKeyFor(nick)) !== undefined;
  if (yieldingToGlare || pinnedAndTrusted) {
    await acceptIncomingOffer(nick);
  }
};

const handleAccept = async (nick: string, frame: Extract<E2eeFrame, { type: 'accept' }>): Promise<void> => {
  const key = getSessionKey(nick);
  const state = getSessionState(nick);
  // Waiting, or timed out but not superseded; any other ACCEPT is unsolicited and ignored
  const awaitingOurOffer =
    state === E2eeState.offered || (state === E2eeState.error && secrets.get(key)?.role === 'initiator');
  if (!awaitingOurOffer) {
    return;
  }
  if (frame.version !== PROTOCOL_VERSION) {
    failSession(nick, 'e2ee.error.versionMismatch');
    return;
  }

  await completeHandshake(nick, 'initiator', frame.identityKeyB64, frame.ephemeralKeyB64);
};

/** OFFER only via PRIVMSG, replies only via NOTICE (CTCP convention), so a peer can't drive invalid transitions. */
export const handleHandshakeFrame = async (
  nick: string,
  frame: E2eeFrame,
  source: 'privmsg' | 'notice',
): Promise<void> => {
  try {
    if (frame.type === 'offer' && source === 'privmsg') {
      await handleOffer(nick, frame);
      return;
    }
    if (frame.type === 'accept' && source === 'notice') {
      await handleAccept(nick, frame);
      return;
    }
    if (frame.type === 'decline' && source === 'notice') {
      const key = getSessionKey(nick);
      clearOfferTimer(key);
      secrets.delete(key);
      setSession(nick, { state: E2eeState.declined, verified: false });
      return;
    }
    if (frame.type === 'reset' && source === 'notice') {
      endSession(nick, false);
    }
  } catch (error) {
    console.warn('E2EE: handshake frame failed:', error);
    failSession(nick, 'e2ee.error.handshakeFailed');
  }
};

export type CipherChunkResult =
  /** More frames needed before anything can be decrypted. */
  | { status: 'incomplete' }
  /** echo-message copy of our own frame; already rendered locally. */
  | { status: 'echo' }
  /** The caller tells the peer. */
  | { status: 'noSession' }
  | { status: 'complete'; sealed: string };

/** Synchronous so the kernel can insert a placeholder in arrival order before decryption resolves. */
export const acceptCipherChunk = (nick: string, frame: Extract<E2eeFrame, { type: 'cipher' }>): CipherChunkResult => {
  if (ownFrameIds.has(frame.frameId)) {
    return { status: 'echo' };
  }
  if (getSessionState(nick) !== E2eeState.active) {
    return { status: 'noSession' };
  }

  const sealed = reassembler.accept(nick, frame);

  return sealed === null ? { status: 'incomplete' } : { status: 'complete', sealed };
};

/** Lets the peer re-handshake. */
export const sendReset = (nick: string): void => {
  sendNoticeCtcp(nick, buildResetFrame());
};

/** Throws if the session is gone or authentication fails. */
export const decryptSealed = async (nick: string, sealed: string): Promise<{ kind: BodyKind; text: string }> => {
  const entry = secrets.get(getSessionKey(nick));
  if (!entry?.keys) {
    throw new Error('No active encryption session');
  }

  return decodeBody(await open(entry.keys.recvKey, sealed));
};

/** Throws rather than ever falling back to plaintext. */
export const sendEncrypted = async (target: string, text: string, kind: BodyKind): Promise<void> => {
  const entry = secrets.get(getSessionKey(target));
  if (!entry?.keys) {
    throw new Error('No active encryption session');
  }

  const sealed = await seal(entry.keys.sendKey, encodeBody(kind, text));
  const frameId = newFrameId();
  const frames = buildCipherFrames(sealed, frameId, chunkCharsFor(getLineLenLimit()));

  rememberOwnFrame(frameId);
  for (const frame of frames) {
    sendPrivmsgCtcp(target, frame);
  }
};

export const endSession = (nick: string, notifyPeer = true): void => {
  const key = getSessionKey(nick);
  const hadSession = secrets.has(key) || getSession(nick) !== undefined;

  clearOfferTimer(key);
  secrets.delete(key);
  // A deliberately ended session must not be re-offered after a reconnect
  resumeCandidates.delete(key);
  reassembler.forget(nick);
  removeSession(nick);

  if (notifyPeer && hadSession) {
    sendNoticeCtcp(nick, buildResetFrame());
  }
};

export const endAllSessions = (): void => {
  // Only `active` sessions resume. Guarded because one disconnect runs this twice; the second, empty call
  // must not overwrite the candidates
  const activePeerKeys = getActiveSessionPeers().map((peer) => getSessionKey(peer));
  if (activePeerKeys.length > 0) {
    resumeCandidates = new Set(activePeerKeys);
  }

  for (const timer of offerTimers.values()) {
    clearTimeout(timer);
  }
  offerTimers.clear();
  secrets.clear();
  ownFrameIds.clear();
  reassembler.clear();
  clearSessions();
};

/**
 * Silent re-offer if E2EE is enabled, the peer is still pinned (the offer re-checks the pin) and the state is
 * still `none`. One shot per drop, so a flapping peer isn't poked repeatedly.
 */
export const resumePendingEncryption = async (nick: string): Promise<void> => {
  const key = getSessionKey(nick);
  if (!resumeCandidates.has(key)) {
    return;
  }
  resumeCandidates.delete(key);

  if (!getE2eeEnabled() || !hasPinnedPeer(nick)) {
    return;
  }
  if (getSessionState(nick) !== E2eeState.none) {
    return;
  }

  await offerEncryption(nick);
};

/** Drops the session: a NICK is no proof it's the same person. Re-offering re-checks the pin. */
export const handlePeerRename = (oldNick: string, newNick: string): void => {
  if (getSession(oldNick) === undefined) {
    return;
  }
  endSession(oldNick, false);
  setSession(newNick, {
    state: E2eeState.error,
    verified: false,
    errorMessage: i18next.t('e2ee.error.peerRenamed', { oldNick, newNick }),
  });
};

/** On 401: fails only an actually pending offer, without waiting for the timeout. */
export const handlePeerOffline = (nick: string): void => {
  if (getSessionState(nick) !== E2eeState.offered) {
    return;
  }
  failSession(nick, 'e2ee.error.peerOffline');
};

/** Downgrade defence: an attacker dropping OFFERs or injecting RESETs can force plaintext, but not silently. */
export const hasPinnedPeer = (nick: string): boolean =>
  getPin(getNetwork(), peerKeyFor(nick)) !== undefined;

/** Only with no session at all (other states have their own banner); doesn't guess attack vs. peer quit. */
export const shouldWarnPlaintext = (nick: string): boolean =>
  getSessionState(nick) === E2eeState.none && !isPlaintextAcknowledged(nick) && hasPinnedPeer(nick);

export const acknowledgePlaintext = (nick: string): void => {
  setPlaintextAcknowledged(nick, true);
};

export const markVerified = (nick: string, verified: boolean): void => {
  setPinVerified(getNetwork(), peerKeyFor(nick), verified);
  patchSession(nick, { verified });
};

export const isOwnFrameId = (frameId: string): boolean => ownFrameIds.has(frameId);

/** Test seam — wipes all in-memory state without touching the wire. */
export const resetSessionModuleForTests = (): void => {
  for (const timer of offerTimers.values()) {
    clearTimeout(timer);
  }
  offerTimers.clear();
  secrets.clear();
  ownFrameIds.clear();
  reassembler.clear();
  resumeCandidates = new Set();
  clearSessions();
};
