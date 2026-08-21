/**
 * SIC-E2EE v1 — handshake state machine and message sealing.
 *
 * At a glance — the questions a new contributor or a security review asks
 * first, answered before any code:
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
 * This module owns all key material. The zustand store next door holds only
 * what the UI renders; private keys and derived session keys live here in a
 * plain module-level map that nothing serialises.
 *
 * Handshake, from the initiator's side:
 *
 *   offerEncryption()  ──OFFER(PRIVMSG)──▶            state: offered
 *                      ◀─ACCEPT(NOTICE)──   pin check, derive → state: active
 *                      ◀─DECLINE(NOTICE)─                     → state: declined
 *                      (no reply within OFFER_TIMEOUT_MS)     → state: error
 *                      (a late ACCEPT still completes it from here)
 *
 * and from the responder's side an inbound OFFER lands in `incoming`, where it
 * waits for the user (there is no auto-accept for an unknown key), then
 * `acceptIncomingOffer()` derives and answers.
 *
 * When both sides offer at once, the folded nicks decide it: the lower one
 * keeps the initiator role and ignores the incoming offer, the higher one
 * abandons its own and answers immediately. Both compute the same comparison,
 * so it costs no extra round trip.
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

/**
 * How long to show "waiting" before telling the user there has been no reply.
 *
 * This budget has to cover network RTT *and* the peer noticing our OFFER and
 * clicking Accept — the second part is human reaction time, not bandwidth,
 * and dwarfs the first on anything but a dead link. 15s used to be tight
 * enough that a peer who took a moment to notice the prompt, or was on a slow
 * connection, would routinely trip it. The outstanding keys are kept regardless
 * (see the timeout callback in `offerEncryption`), so an ACCEPT that arrives
 * after this fires still completes the handshake — this only controls when we
 * stop saying "waiting" and start saying "no reply yet".
 */
const OFFER_TIMEOUT_MS = 60_000;

/** How many of our own recent frame ids to remember, so echoed frames can be dropped. */
const OWN_FRAME_MEMORY = 256;

/**
 * Everything a handshake-in-progress (or completed one) needs to hold onto.
 * Lives only in the module-level `secrets` map below, never in the zustand
 * store — see the file header for why key material stays out of there.
 */
interface SessionSecrets {
  /** Whether we sent the OFFER or are answering one — passed to `deriveSessionKeys` once the handshake completes. */
  role: HandshakeRole;
  /** Our long-term key pair for this network. */
  identity: Identity;
  /** Our throwaway key pair for this conversation. */
  ephemeral: KeyPairWithPublic;
  /** The peer's keys from an inbound OFFER, held while the user decides. */
  pendingOffer?: { identityKeyB64: string; ephemeralKeyB64: string };
  /** Set once the handshake completes — encrypts/decrypts this conversation's messages until the session ends. */
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

/**
 * Pin this key for the peer if we haven't already, and report whether it was
 * already verified — `completeHandshake` uses that to decide whether the new
 * session starts out trusted or needs the fingerprint checked again.
 */
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

  // Encryption is back, so any earlier "yes, plaintext is fine" is spent. If
  // this session is lost again the user gets told again.
  setPlaintextAcknowledged(nick, false);

  setSession(nick, {
    state: E2eeState.active,
    verified,
    myFingerprint: entry.identity.fingerprint,
    theirFingerprint,
  });
};

/** Send an OFFER and wait. A peer that isn't a SIC client simply never answers. */
export const offerEncryption = async (nick: string): Promise<void> => {
  // The UI is expected to hide every path that reaches this (button, context
  // menu, slash command), but the guard lives here too: this is the one
  // choke point every one of those paths goes through, so it is what actually
  // stops an offer regardless of which surface is missed.
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
        // Only give up if nothing moved us on; a late ACCEPT still wins.
        if (getSessionState(nick) === E2eeState.offered) {
          // The ephemeral keypair deliberately survives this: an ACCEPT that
          // was already on its way when this fired — slow link, or a peer who
          // took a moment to click — must still be able to complete the
          // handshake. `handleAccept` allows exactly that as long as nothing
          // has superseded this offer (a fresh offerEncryption(), or the user
          // cancelling) in the meantime. Only the visible state changes here.
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
  // Encryption turned off locally: decline without ever surfacing the offer,
  // so the user isn't shown a prompt for a choice that's already been made.
  // The peer still gets a DECLINE, same as a user-driven refusal, so their
  // banner resolves instead of hanging on OFFER_TIMEOUT_MS.
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

  // Validate both keys before showing anything: a peer that sends junk should
  // produce an error, not a prompt inviting the user to trust it.
  await importPublicKey(frame.identityKeyB64);
  await importPublicKey(frame.ephemeralKeyB64);

  const key = getSessionKey(nick);
  const previousState = getSessionState(nick);

  // Glare: both sides sent an OFFER at the same time. Without a tie-break each
  // side would answer the other's offer as responder, and the two would derive
  // from different ephemeral pairs — leaving both windows showing a padlock
  // while nothing decrypts. Comparing folded nicks gives both clients the same
  // answer with no extra round trip, and exactly one of them yields.
  const yieldingToGlare = previousState === E2eeState.offered;
  if (yieldingToGlare && getSessionKey(getCurrentNick()) < key) {
    // We hold the initiator role; our own offer is still outstanding.
    return;
  }

  const theirFingerprint = await fingerprintFromB64(frame.identityKeyB64);
  const identity = await getIdentity();

  const mismatch = checkPin(nick, frame.identityKeyB64);
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

  // Only now is whatever we were holding discarded. An OFFER replaces any
  // existing session outright — the peer evidently no longer holds the old keys
  // or they would not be asking to start again — so the half-assembled frames
  // and the outstanding offer timer that belonged to it have to go with it.
  // Leaving buffered chunks behind would let fragments of a dead session sit in
  // memory waiting to be mixed with the new one's.
  clearOfferTimer(key);
  reassembler.forget(nick);

  // Generated after the pin check, not before: a peer whose key already fails
  // should not cost us an ECDH keypair per offer.
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

  // Yielding to glare answers immediately: this user already asked for
  // encryption by sending their own offer, so prompting them again for the
  // same decision would be noise. The pin is still checked in either case.
  //
  // Auto-accept otherwise applies only to a peer whose identity key we have
  // seen before and that still matches. An unknown key is exactly the case
  // where the user's judgement is the security control, so it always waits for
  // them — the setting speeds up conversations you already have, it never
  // trusts a stranger on your behalf.
  const pinnedAndTrusted = getAutoOfferEncryption() && getPin(getNetwork(), peerKeyFor(nick)) !== undefined;
  if (yieldingToGlare || pinnedAndTrusted) {
    await acceptIncomingOffer(nick);
  }
};

const handleAccept = async (nick: string, frame: Extract<E2eeFrame, { type: 'accept' }>): Promise<void> => {
  const key = getSessionKey(nick);
  const state = getSessionState(nick);
  // Still our outstanding offer either while we're actively waiting, or — a
  // late reply — after the wait timed out but nothing has superseded it
  // since (a fresh offer, a cancel, or a completed handshake all replace or
  // clear this entry). Anything else is an ACCEPT we never asked for; ignore
  // it rather than deriving a session some third party talked us into.
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
  const frames = buildCipherFrames(sealed, frameId, chunkCharsFor(getLineLenLimit()));

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

/**
 * Has this peer's identity ever been pinned on this network?
 *
 * This is what turns the pin store into a downgrade defence rather than just a
 * key cache. Encryption here is opt-in and best-effort, so an attacker who can
 * drop OFFER frames or inject RESET notices gets the conversation back in the
 * clear — and, without this, gets it silently. Knowing that the two of you have
 * encrypted before is exactly the fact that makes the silence suspicious.
 */
export const hasPinnedPeer = (nick: string): boolean =>
  getPin(getNetwork(), peerKeyFor(nick)) !== undefined;

/**
 * Should the conversation warn that it is unencrypted?
 *
 * Only when there is no session at all: the other states carry their own,
 * more specific banner. Deliberately does not try to distinguish an attack
 * from the peer simply having quit — we cannot tell the two apart, and a
 * warning that guessed would be worse than one that states what is true.
 */
export const shouldWarnPlaintext = (nick: string): boolean =>
  getSessionState(nick) === E2eeState.none && !isPlaintextAcknowledged(nick) && hasPinnedPeer(nick);

/** The user has seen the plaintext warning and accepted it for this conversation. */
export const acknowledgePlaintext = (nick: string): void => {
  setPlaintextAcknowledged(nick, true);
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
