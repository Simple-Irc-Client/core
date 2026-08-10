/**
 * SIC-E2EE v1 — the receive path, called from `Kernel.handleCtcp`.
 *
 * This lives outside `kernel.ts` to keep an already very large file from
 * growing another state machine, but the ordering rule it implements is a
 * kernel concern and worth spelling out:
 *
 * `onPrivMsg` is synchronous while WebCrypto is not. Decrypting first and
 * calling `setAddMessage` in the `.then()` would let two messages that arrive
 * back to back render in whichever order their decryptions happened to settle.
 * So a placeholder is appended synchronously, in arrival order, and patched in
 * place once the plaintext is ready. That also gives failures somewhere natural
 * to land, and it works unchanged for `draft/chathistory` replay — which is why
 * the hook has to sit here in the CTCP handler rather than in `handleRaw`.
 */

import i18next from 'i18next';
import { v4 as uuidv4 } from 'uuid';

import { MessageColor } from '@/config/theme';
import {
  existChannel,
  setAddChannel,
  setAddMessage,
  setHasMention,
  setIncreaseUnreadMessages,
  setTyping,
  setUpdateMessage,
} from '@/features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, isSameName } from '@/features/settings/store/settings';
import { getUser } from '@/features/users/store/users';
import { notifyHighlight } from '@/runtime/notifications';
import { ChannelCategory, MessageCategory } from '@shared/types';

import { BodyKind, parseCtcpFrame, type E2eeFrame } from './protocol';
import { createThrottle } from './rateLimit';
import { acceptCipherChunk, decryptSealed, handleHandshakeFrame, sendReset } from './session';
import { E2eeState, getSessionKey, getSessionState } from './store/e2ee';

/**
 * One inbound OFFER per peer per second.
 *
 * Generous enough that no legitimate pattern is affected — a handshake is one
 * offer, and glare or a retry after the offer timeout are both far slower than
 * this — while stopping a peer from spending our CPU at whatever rate the
 * server permits.
 */
const offers = createThrottle(1_000);

/**
 * A peer talking to us with keys we no longer have would otherwise produce one
 * error line and one RESET per frame.
 */
const resetReplies = createThrottle(10_000);

/**
 * Decide whether to act on an inbound OFFER.
 *
 * Called from the synchronous entry point, before any key import or keypair
 * generation, so a refused frame costs a map lookup and nothing else.
 */
const allowOffer = (nick: string): boolean => offers.allow(getSessionKey(nick));

/** The window an inbound direct message belongs in: ours is named after the sender. */
const resolveWindow = (nick: string, target: string): string => (isSameName(target, getCurrentNick()) ? nick : target);

/**
 * Build the local id for a decrypted message.
 *
 * The server's `msgid` cannot be used as-is. This id is what the placeholder is
 * inserted under and what `setUpdateMessage` later patches by, so a server that
 * reused a msgid it had already given to a *plaintext* message would have the
 * decrypted text overwrite that unrelated message's body. Namespacing keeps the
 * server's value — so a frame delivered twice in one session still dedupes —
 * while making it impossible to collide with an id from outside this path.
 */
const localMessageId = (msgid?: string): string =>
  msgid !== undefined && msgid.length > 0 ? `e2ee:${msgid}` : `e2ee:${uuidv4()}`;

const ensureWindow = (window: string): void => {
  if (!existChannel(window)) {
    setAddChannel(window, ChannelCategory.priv);
  }
};

/** Add a system line to a private window — used for handshake outcomes. */
const addInfoMessage = (window: string, text: string): void => {
  ensureWindow(window);
  setAddMessage({
    id: uuidv4(),
    message: text,
    target: window,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

/**
 * Announce a handshake result once the frame has been processed.
 *
 * Comparing state before and after keeps this in one place instead of scattering
 * `setAddMessage` calls through the state machine, which has no business knowing
 * about chat windows.
 */
const announceStateChange = (nick: string, before: E2eeState, after: E2eeState): void => {
  if (before === after) {
    return;
  }

  if (after === E2eeState.active) {
    addInfoMessage(nick, i18next.t('e2ee.info.started', { nick }));
    return;
  }
  // Any move away from `active` ends the encrypted conversation, not just a
  // teardown: a fresh OFFER from the peer replaces the session outright, and
  // the user needs to know the padlock they had is gone.
  if (before === E2eeState.active) {
    addInfoMessage(nick, i18next.t('e2ee.info.ended', { nick }));
    return;
  }
  if (after === E2eeState.declined) {
    addInfoMessage(nick, i18next.t('e2ee.info.declined', { nick }));
  }
};

const handleHandshake = (nick: string, frame: E2eeFrame, source: 'privmsg' | 'notice'): void => {
  const before = getSessionState(nick);

  // The real source has to be passed through. Deriving it from the frame type
  // instead would make `handleHandshakeFrame`'s verb check unfalsifiable — it
  // would only ever see the verb the frame claims to be, so a peer could drive
  // the state machine with an OFFER sent as a NOTICE, or a RESET as a PRIVMSG.
  void handleHandshakeFrame(nick, frame, source).then(() => {
    announceStateChange(nick, before, getSessionState(nick));
  });
};

interface CipherContext {
  nick: string;
  window: string;
  messageId: string;
  time: string;
}

/**
 * Insert the placeholder, then patch it with the plaintext.
 *
 * The message id comes from the server's `msgid` tag where there is one, so the
 * dedupe in `setAddMessage` still works when chathistory replays a message we
 * already have.
 */
const renderDecrypted = (context: CipherContext, sealed: string): void => {
  const { nick, window, messageId, time } = context;
  const currentChannelName = getCurrentChannelName();

  ensureWindow(window);
  setTyping(window, nick, 'done');

  setAddMessage({
    id: messageId,
    message: i18next.t('e2ee.message.decrypting'),
    nick: getUser(nick) ?? nick,
    target: window,
    time,
    category: MessageCategory.default,
    color: MessageColor.default,
    highlight: true,
    e2ee: 'decrypting',
  });

  if (!isSameName(window, currentChannelName)) {
    setIncreaseUnreadMessages(window);
    setHasMention(window);
  }

  void decryptSealed(nick, sealed).then(
    ({ kind, text }) => {
      setUpdateMessage(window, messageId, {
        message: text,
        category: kind === BodyKind.action ? MessageCategory.me : MessageCategory.default,
        color: kind === BodyKind.action ? MessageColor.me : MessageColor.default,
        e2ee: 'ok',
      });

      void notifyHighlight({ nick, target: window, message: text, isDirect: true });
    },
    (error: unknown) => {
      // A frame that fails authentication is not shown as text under any
      // circumstances — that would be presenting attacker-controlled bytes as a
      // message from a peer the lock icon says is verified.
      console.warn('E2EE: could not decrypt message:', error);
      setUpdateMessage(window, messageId, { message: i18next.t('e2ee.message.failed'), e2ee: 'failed' });
    },
  );
};

const handleCipher = (nick: string, window: string, frame: Extract<E2eeFrame, { type: 'cipher' }>, messageId: string, time: string): void => {
  const result = acceptCipherChunk(nick, frame);

  switch (result.status) {
    case 'complete':
      renderDecrypted({ nick, window, messageId, time }, result.sealed);
      return;
    case 'noSession':
      if (resetReplies.allow(getSessionKey(nick))) {
        sendReset(nick);
        addInfoMessage(window, i18next.t('e2ee.info.unreadable', { nick }));
      }
      return;
    // 'echo' — our own message, already rendered locally on send.
    // 'incomplete' — waiting on more frames.
    default:
  }
};

export interface E2eeCtcpContext {
  /** Sender nick. */
  nick: string;
  /** CTCP target: our nick for an inbound DM, or a channel. */
  target: string;
  /** CTCP body with the `\x01` delimiters already stripped. */
  ctcpContent: string;
  /** Which command carried it — the protocol distinguishes the two. */
  source: 'privmsg' | 'notice';
  /** Server `msgid` tag, when present. */
  msgid?: string;
  /** Server `time` tag, when present. */
  time?: string;
}

/**
 * Handle a CTCP that might be an E2EE frame.
 *
 * Returns `true` when the frame was ours and has been dealt with, so the caller
 * stops. Returns `false` for anything else, including well-formed frames aimed
 * at a channel — encryption here is strictly one-to-one, and a "SICE" sent to a
 * channel is not something this protocol produces.
 */
export const handleE2eeCtcp = (context: E2eeCtcpContext): boolean => {
  const frame = parseCtcpFrame(context.ctcpContent);
  if (frame === null) {
    return false;
  }

  const { nick, target, source } = context;
  const window = resolveWindow(nick, target);

  // Only ever act on a one-to-one conversation.
  if (!isSameName(target, getCurrentNick())) {
    return false;
  }

  // Refused before any crypto runs: an OFFER is the only inbound frame that
  // costs real work regardless of whether it is wanted. ACCEPT is self-limiting
  // (it does nothing unless we are waiting for one) and the rest are trivial.
  if (frame.type === 'offer' && !allowOffer(nick)) {
    return true;
  }

  if (frame.type === 'cipher') {
    if (source !== 'privmsg') {
      return false;
    }
    handleCipher(nick, window, frame, localMessageId(context.msgid), context.time ?? new Date().toISOString());
    return true;
  }

  handleHandshake(nick, frame, source);

  return true;
};

/** Drop throttle bookkeeping — called alongside `endAllSessions` on disconnect. */
export const clearIncomingState = (): void => {
  offers.clear();
  resetReplies.clear();
};
