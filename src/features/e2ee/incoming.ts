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
import { acceptCipherChunk, decryptSealed, handleHandshakeFrame, sendReset } from './session';
import { E2eeState, getSessionState } from './store/e2ee';

/**
 * A peer talking to us with keys we no longer have would otherwise produce one
 * error line and one RESET per frame. Answer at most this often per peer.
 */
const RESET_THROTTLE_MS = 10_000;

const lastResetAt = new Map<string, number>();

const shouldAnswerWithReset = (nick: string, now: number): boolean => {
  const previous = lastResetAt.get(nick.toLowerCase());
  if (previous !== undefined && now - previous < RESET_THROTTLE_MS) {
    return false;
  }
  lastResetAt.set(nick.toLowerCase(), now);

  return true;
};

/** The window an inbound direct message belongs in: ours is named after the sender. */
const resolveWindow = (nick: string, target: string): string => (isSameName(target, getCurrentNick()) ? nick : target);

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
  if (before === E2eeState.active && after === E2eeState.none) {
    addInfoMessage(nick, i18next.t('e2ee.info.ended', { nick }));
    return;
  }
  if (after === E2eeState.declined) {
    addInfoMessage(nick, i18next.t('e2ee.info.declined', { nick }));
  }
};

const handleHandshake = (nick: string, frame: E2eeFrame): void => {
  const before = getSessionState(nick);

  void handleHandshakeFrame(nick, frame, frame.type === 'offer' ? 'privmsg' : 'notice').then(() => {
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
      if (shouldAnswerWithReset(nick, Date.now())) {
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

  if (frame.type === 'cipher') {
    if (source !== 'privmsg') {
      return false;
    }
    handleCipher(nick, window, frame, context.msgid ?? uuidv4(), context.time ?? new Date().toISOString());
    return true;
  }

  handleHandshake(nick, frame);

  return true;
};

/** Drop throttle bookkeeping — called alongside `endAllSessions` on disconnect. */
export const clearIncomingState = (): void => {
  lastResetAt.clear();
};
