/**
 * SIC-E2EE v1 — handshake state machine and message sealing.
 *
 * This module owns all key material. The zustand store next door holds only
 * what the UI renders; private keys and derived session keys live here in a
 * plain module-level map that nothing serialises.
 *
 * Handshake, from the initiator's side:
 *
 *   offerEncryption()  ──OFFER(PRIVMSG)──▶            state: offered
 *                      ◀─ACCEPT(NOTICE)──   pin check, derive → state: active
 *                      ◀─DECLINE(NOTICE)─                     → state: declined
 *                      (no reply within 15 s)                 → state: none
 *
 * and from the responder's side an inbound OFFER lands in `incoming`, where it
 * waits for the user (there is no auto-accept for an unknown key), then
 * `acceptIncomingOffer()` derives and answers.
 */

import i18next from 'i18next';

import { getAutoOfferEncryption, getServer } from '@/features/settings/store/settings';
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
  getSession,
  getSessionKey,
  getSessionState,
  patchSession,
  removeSession,
  setSession,
  clearSessions,
} from './store/e2ee';
import { getPeerKey, getPin, putPin, setPinVerified } from './store/pins';

/** How long to wait for a reply before concluding the peer is not a SIC client. */
const OFFER_TIMEOUT_MS = 15_000;

/** How many of our own recent frame ids to remember, so echoed frames can be dropped. */
const OWN_FRAME_MEMORY = 256;

interface SessionSecrets {
  role: HandshakeRole;
  identity: Identity;
  ephemeral: KeyPairWithPublic;
  /** The peer's keys from an inbound OFFER, held while the user decides. */
  pendingOffer?: { identityKeyB64: string; ephemeralKeyB64: string };
  keys?: SessionKeys;
}

/** Key material, keyed by folded nick. Never persisted, never in the store. */
const secrets = new Map<string, SessionSecrets>();

/** Pending offer timeouts, keyed by folded nick. */
const offerTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Frame ids we sent. With `echo-message` the server hands our own PRIVMSG back
 * to us; the encrypted path renders locally on send, so the echo must be
 * dropped rather than shown twice.
 */
const ownFrameIds = new Set<string>();

const reassembler = createReassembler();

const getNetwork = (): string => {
  const network = getServer()?.network;

  return network && network.length > 0 ? network : 'default';
};

/** Resolve the durable identifier we pin against — account where known, nick otherwise. */
const peerKeyFor = (nick: string): string => getPeerKey(nick, getUser(nick)?.account);

const clearOfferTimer = (key: string): void => {
  const timer = offerTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    offerTimers.delete(key);
  }
};

/** CTCP delimiter. Without it the peer's `handleCtcp` never sees the frame at all. */
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
 * Compare a peer's identity key against what we pinned.
 *
 * Returns `null` when the key is acceptable (unknown peer, or an exact match),
 * and the pinned fingerprint when it disagrees — which the caller turns into a
 * blocking warning rather than a silent re-key.
 */
const checkPin = (nick: string, identityKeyB64: string): { pinnedFingerprint: string } | null => {
  const pin = getPin(getNetwork(), peerKeyFor(nick));
  if (!pin || pin.identityKeyB64 === identityKeyB64) {
    return null;
  }

  return { pinnedFingerprint: pin.fingerprint };
};

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

/**
 * Finish a handshake: derive the directional keys, pin the peer, go active.
 * Any crypto failure here ends as a visible error, never as a quiet fallback to
 * plaintext.
 */
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

  const mismatch = checkPin(nick, theirIdentityKeyB64);
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

  setSession(nick, {
    state: E2eeState.active,
    verified,
    myFingerprint: entry.identity.fingerprint,
    theirFingerprint,
  });
};

/** Send an OFFER and wait. A peer that isn't a SIC client simply never answers. */
export const offerEncryption = async (nick: string): Promise<void> => {
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
        // Only give up if nothing moved us on; a late ACCEPT still wins.
        if (getSessionState(nick) === E2eeState.offered) {
          secrets.delete(key);
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

/** Answer an inbound OFFER with our own keys. */
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

/** Refuse an inbound OFFER. The peer is told, so their banner resolves. */
export const declineIncomingOffer = (nick: string): void => {
  const key = getSessionKey(nick);
  secrets.delete(key);
  clearOfferTimer(key);
  sendNoticeCtcp(nick, buildDeclineFrame());
  removeSession(nick);
};

const handleOffer = async (nick: string, frame: Extract<E2eeFrame, { type: 'offer' }>): Promise<void> => {
  if (frame.version !== PROTOCOL_VERSION) {
    setSession(nick, {
      state: E2eeState.error,
      verified: false,
      errorMessage: i18next.t('e2ee.error.versionMismatch', { nick }),
    });
    return;
  }

  // Validate both keys before showing anything: a peer that sends junk should
  // produce an error, not a prompt inviting the user to trust it.
  await importPublicKey(frame.identityKeyB64);
  await importPublicKey(frame.ephemeralKeyB64);

  const theirFingerprint = await fingerprintFromB64(frame.identityKeyB64);
  const identity = await getIdentity();
  const ephemeral = await generateEphemeral();
  const key = getSessionKey(nick);

  const mismatch = checkPin(nick, frame.identityKeyB64);
  if (mismatch) {
    secrets.delete(key);
    setSession(nick, {
      state: E2eeState.fingerprintChanged,
      verified: false,
      myFingerprint: identity.fingerprint,
      theirFingerprint,
      expectedFingerprint: mismatch.pinnedFingerprint,
    });
    return;
  }

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

  // Auto-accept only for a peer whose identity key we have seen before and that
  // still matches. An unknown key is exactly the case where the user's judgement
  // is the security control, so it always waits for them — the setting speeds up
  // conversations you already have, it never trusts a stranger on your behalf.
  if (getAutoOfferEncryption() && getPin(getNetwork(), peerKeyFor(nick)) !== undefined) {
    await acceptIncomingOffer(nick);
  }
};

const handleAccept = async (nick: string, frame: Extract<E2eeFrame, { type: 'accept' }>): Promise<void> => {
  if (getSessionState(nick) !== E2eeState.offered) {
    // An ACCEPT we never asked for. Ignore it rather than deriving a session
    // some third party talked us into.
    return;
  }
  if (frame.version !== PROTOCOL_VERSION) {
    failSession(nick, 'e2ee.error.versionMismatch');
    return;
  }

  await completeHandshake(nick, 'initiator', frame.identityKeyB64, frame.ephemeralKeyB64);
};

/**
 * Route an inbound handshake frame.
 *
 * `source` matters: an OFFER arrives by PRIVMSG and the replies by NOTICE, per
 * CTCP convention. Accepting either verb from either direction would let a peer
 * drive the state machine in ways the protocol doesn't allow.
 */
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
  /** Our own message echoed back by the server; already rendered locally. */
  | { status: 'echo' }
  /** No session for this peer — the caller tells them so. */
  | { status: 'noSession' }
  | { status: 'complete'; sealed: string };

/**
 * Feed an inbound cipher frame into the reassembly buffer.
 *
 * Synchronous on purpose: the kernel needs an immediate answer so it can insert
 * a placeholder message in arrival order before the asynchronous decryption
 * resolves. Doing the ordering any other way lets concurrent messages land out
 * of sequence.
 */
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

/** Tell a peer we cannot read what they sent, so their client can re-handshake. */
export const sendReset = (nick: string): void => {
  sendNoticeCtcp(nick, buildResetFrame());
};

/** Decrypt a fully reassembled payload. Throws if the session is gone or the frame fails authentication. */
export const decryptSealed = async (nick: string, sealed: string): Promise<{ kind: BodyKind; text: string }> => {
  const entry = secrets.get(getSessionKey(nick));
  if (!entry?.keys) {
    throw new Error('No active encryption session');
  }

  return decodeBody(await open(entry.keys.recvKey, sealed));
};

/**
 * Encrypt and send a message. Resolves once the frames are on the wire.
 *
 * Throws rather than falling back to plaintext: silently downgrading a
 * conversation the user believes is encrypted would be the worst possible
 * failure mode here.
 */
export const sendEncrypted = async (target: string, text: string, kind: BodyKind): Promise<void> => {
  const entry = secrets.get(getSessionKey(target));
  if (!entry?.keys) {
    throw new Error('No active encryption session');
  }

  const sealed = await seal(entry.keys.sendKey, encodeBody(kind, text));
  const frameId = newFrameId();
  const frames = buildCipherFrames(sealed, frameId);

  rememberOwnFrame(frameId);
  for (const frame of frames) {
    sendPrivmsgCtcp(target, frame);
  }
};

/** End a session, optionally telling the peer so their UI updates too. */
export const endSession = (nick: string, notifyPeer = true): void => {
  const key = getSessionKey(nick);
  const hadSession = secrets.has(key) || getSession(nick) !== undefined;

  clearOfferTimer(key);
  secrets.delete(key);
  reassembler.forget(nick);
  removeSession(nick);

  if (notifyPeer && hadSession) {
    sendNoticeCtcp(nick, buildResetFrame());
  }
};

/** Drop every session — on disconnect, or when switching servers. */
export const endAllSessions = (): void => {
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
 * Handle the peer renaming.
 *
 * The session is dropped rather than carried across. The keys would still work
 * — they are bound to identity keys, not nicks — but on IRC a NICK we observe
 * is not proof the same person is behind it, and quietly following the new nick
 * would carry a trusted, lock-badged window somewhere the user didn't agree to.
 * Re-offering takes one click and re-checks the pin.
 */
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

/** Record that the user compared fingerprints out of band. */
export const markVerified = (nick: string, verified: boolean): void => {
  setPinVerified(getNetwork(), peerKeyFor(nick), verified);
  patchSession(nick, { verified });
};

/** True when the frame id is one we just sent — used to drop `echo-message` copies. */
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
  clearSessions();
};
