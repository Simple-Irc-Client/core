/**
 * SIC-E2EE v1 receive path, called from Kernel.handleCtcp. A placeholder is appended synchronously in
 * arrival order and patched once WebCrypto resolves, so concurrent decryptions can't reorder messages.
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
import { subscribeDmPresence } from '@/features/dmPresence/dmPresence';
import { ChannelCategory, MessageCategory } from '@shared/types';

import { BodyKind, parseCtcpFrame, type E2eeFrame } from './protocol';
import { createThrottle } from './rateLimit';
import { acceptCipherChunk, acceptIncomingOffer, decryptSealed, endSession, handleHandshakeFrame, sendReset } from './session';
import { E2eeState, getSessionKey, getSessionState } from './store/e2ee';

/** One inbound OFFER per peer per second: no legitimate pattern is faster. */
const offers = createThrottle(1_000);

/** Otherwise a peer with stale keys yields an error line and a RESET per frame. */
const resetReplies = createThrottle(10_000);

/** Checked before any crypto, so a refused frame costs only a map lookup. */
const allowOffer = (nick: string): boolean => offers.allow(getSessionKey(nick));

/** Namespaced msgid: still dedupes, but can't patch a plaintext message that reused the same msgid. */
const localMessageId = (msgid?: string): string =>
  msgid !== undefined && msgid.length > 0 ? `e2ee:${msgid}` : `e2ee:${uuidv4()}`;

const ensureWindow = (window: string): void => {
  if (!existChannel(window)) {
    setAddChannel(window, ChannelCategory.priv);
    subscribeDmPresence(window);
  }
};

const addInfoMessage = (window: string, text: string, color: MessageColor = MessageColor.info): void => {
  ensureWindow(window);
  setAddMessage({
    id: uuidv4(),
    message: text,
    target: window,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color,
    system: true,
  });
};

/** Diffs state before/after, so the state machine never needs to know about chat windows. */
const announceStateChange = (nick: string, before: E2eeState, after: E2eeState): void => {
  if (before === after) {
    return;
  }

  if (after === E2eeState.active) {
    addInfoMessage(nick, i18next.t('e2ee.info.started', { nick }), MessageColor.e2ee);
    return;
  }
  // Any move away from `active` (e.g. a fresh OFFER) ends it
  if (before === E2eeState.active) {
    addInfoMessage(nick, i18next.t('e2ee.info.ended', { nick }), MessageColor.error);
    return;
  }
  if (after === E2eeState.declined) {
    addInfoMessage(nick, i18next.t('e2ee.info.declined', { nick }));
    return;
  }
  // Needs unread treatment like a plain message, or the request stays invisible
  if (after === E2eeState.incoming) {
    addInfoMessage(nick, i18next.t('e2ee.info.incomingOffer', { nick }), MessageColor.notice);
    if (!isSameName(nick, getCurrentChannelName())) {
      setIncreaseUnreadMessages(nick);
      setHasMention(nick);
    }
  }
};

/** UI must use this, not acceptIncomingOffer directly, or the accepting side never gets the "now encrypted" line. */
export const acceptOfferAndAnnounce = async (nick: string): Promise<void> => {
  const before = getSessionState(nick);
  await acceptIncomingOffer(nick);
  announceStateChange(nick, before, getSessionState(nick));
};

/** Likewise for ending: endSession alone gives the local user no "encryption ended" line. */
export const endSessionAndAnnounce = (nick: string, notifyPeer = true): void => {
  const before = getSessionState(nick);
  endSession(nick, notifyPeer);
  announceStateChange(nick, before, getSessionState(nick));
};

const handleHandshake = (nick: string, frame: E2eeFrame, source: 'privmsg' | 'notice'): void => {
  const before = getSessionState(nick);

  // The real source, not one derived from the frame type, or the verb check would be unfalsifiable
  void handleHandshakeFrame(nick, frame, source).then(() => {
    announceStateChange(nick, before, getSessionState(nick));
  });
};

/** `time` is from the server's `time` tag when present */
const renderDecrypted = (nick: string, messageId: string, time: string, sealed: string): void => {
  // A DM's window is named after the peer
  const window = nick;
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
      // Never show unauthenticated bytes as a message from a verified peer
      console.warn('E2EE: could not decrypt message:', error);
      setUpdateMessage(window, messageId, { message: i18next.t('e2ee.message.failed'), e2ee: 'failed' });
    },
  );
};

const handleCipher = (nick: string, frame: Extract<E2eeFrame, { type: 'cipher' }>, messageId: string, time: string): void => {
  const result = acceptCipherChunk(nick, frame);

  switch (result.status) {
    case 'complete':
      renderDecrypted(nick, messageId, time, result.sealed);
      return;
    case 'noSession':
      // Tell both the peer and our user rather than silently dropping it
      if (resetReplies.allow(getSessionKey(nick))) {
        sendReset(nick);
        addInfoMessage(nick, i18next.t('e2ee.info.unreadable', { nick }));
      }
      return;
    case 'echo':
    case 'incomplete':
      return;
  }
};

export interface E2eeCtcpContext {
  nick: string;
  target: string;
  /** Without the `\x01` delimiters. */
  ctcpContent: string;
  /** The protocol distinguishes the two. */
  source: 'privmsg' | 'notice';
  msgid?: string;
  time?: string;
}

/** True when handled. Channel-targeted frames are never ours: encryption is strictly one-to-one. */
export const handleE2eeCtcp = (context: E2eeCtcpContext): boolean => {
  const frame = parseCtcpFrame(context.ctcpContent);
  if (frame === null) {
    return false;
  }

  const { nick, target, source } = context;

  if (!isSameName(target, getCurrentNick())) {
    return false;
  }

  // Only OFFER costs real work unsolicited; ACCEPT is self-limiting
  if (frame.type === 'offer' && !allowOffer(nick)) {
    return true;
  }

  if (frame.type === 'cipher') {
    if (source !== 'privmsg') {
      return false;
    }
    handleCipher(nick, frame, localMessageId(context.msgid), context.time ?? new Date().toISOString());
    return true;
  }

  handleHandshake(nick, frame, source);

  return true;
};

/** Alongside endAllSessions on disconnect. */
export const clearIncomingState = (): void => {
  offers.clear();
  resetReplies.clear();
};
