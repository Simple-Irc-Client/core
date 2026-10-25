import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentNick, useSettingsStore } from '@features/settings/store/settings';
import { type Message, MessageCategory } from '@shared/types';
import { ircSendCommand, ircSendRawMessage } from '@/network/irc/network';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { buildPrivmsgs } from '@/network/irc/multiline';
import { parseMessageToCommand } from '@/network/irc/command';
import { setAddMessage, setUpdateMessage } from '@features/channels/store/channels';
import { BodyKind } from '@features/e2ee/protocol';
import { sendEncrypted } from '@features/e2ee/session';
import { isSessionActive } from '@features/e2ee/store/e2ee';
import { getUser } from '@features/users/store/users';
import { MessageColor } from '@/config/theme';
import { showOwnCommandMessages } from '@features/chat/ownMessages';
import { applySpoilerMarkup } from '@features/chat/spoilers';
import { quoteLine, replyTags } from '@features/replies/replies';
import { clearReplyTo } from '@features/replies/store/replyTo';
import { applyFormatting, gateOutgoingCommand } from '@features/chat/outgoing';

/** Whether what the user typed went out; a blocked one stays in the input */
export type SendResult = 'sent' | 'blocked';

/**
 * Sends what the user typed in the window: a command, or a message in their chosen style. An encrypted
 * conversation gets it encrypted, never in plaintext, and a reply refers to the message it answers.
 */
export const useSendMessage = (channelName: string, isSystemChannel: boolean, replyTo: Message | undefined): ((typed: string) => SendResult) => {
  const { t } = useTranslation();
  const fontFormatting = useSettingsStore((state) => state.fontFormatting);

  /** Encrypts and sends; on failure shows an error and never falls back to plaintext. */
  const sendEncryptedMessage = (target: string, body: string, kind: BodyKind): void => {
    const senderNick = getCurrentNick();
    const localId = uuidv4();
    const isAction = kind === BodyKind.action;

    setAddMessage({
      id: localId,
      message: body,
      nick: getUser(senderNick) ?? senderNick,
      target,
      time: new Date().toISOString(),
      category: isAction ? MessageCategory.me : MessageCategory.default,
      color: isAction ? MessageColor.me : MessageColor.default,
      e2ee: 'ok',
    });

    void sendEncrypted(target, body, kind).catch((error: unknown) => {
      console.warn('E2EE: could not send message:', error);
      setUpdateMessage(target, localId, { e2ee: 'failed', message: t('e2ee.message.sendFailed', { message: body }) });
    });
  };

  const sendPlainMessage = (text: string, answering?: Message): void => {
    const tags = answering === undefined ? undefined : replyTags(answering);
    const nick = getCurrentNick();

    for (const [index, { text: sentText, lines: [command, ...rest] }] of buildPrivmsgs(nick, channelName, text, tags).entries()) {
      // With echo-message the server echoes it back and it's added then
      if (!isCapabilityEnabled('echo-message')) {
        setAddMessage({
          id: uuidv4(),
          replyTo: index === 0 && tags !== undefined ? answering?.msgid : undefined,
          message: sentText,
          nick: getUser(nick) ?? nick,
          target: channelName,
          time: new Date().toISOString(),
          category: MessageCategory.default,
          color: MessageColor.default,
        });
      }

      ircSendCommand(command, { window: channelName });
      for (const line of rest) {
        ircSendRawMessage(line);
      }
    }
  };

  const sendCommand = (typed: string): SendResult => {
    const payload = parseMessageToCommand(channelName, typed);

    const gated = gateOutgoingCommand(payload);
    if (gated?.verdict === 'encrypt') {
      sendEncryptedMessage(gated.target, gated.body, gated.kind);
      return 'sent';
    }
    if (gated?.verdict === 'block') {
      setAddMessage({
        id: uuidv4(),
        message: t('e2ee.error.noticeBlocked', { nick: gated.target }),
        target: channelName,
        time: new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.error,
      });
      return 'blocked';
    }

    // With echo-message the server echoes it back and it's added then
    if (!isCapabilityEnabled('echo-message')) {
      showOwnCommandMessages(payload, channelName);
    }
    ircSendCommand(payload, { window: channelName });
    return 'sent';
  };

  const sendChatMessage = (typed: string): void => {
    // Line by line: without draft/multiline each line is a message of its own
    const formattedMessage = typed
      .split('\n')
      .map((line) => (line === '' ? line : applyFormatting(applySpoilerMarkup(line, fontFormatting.colorCode), fontFormatting)))
      .join('\n');

    if (isSessionActive(channelName)) {
      // Rendered locally even with echo-message: the echoed SICE frame is dropped by frame id
      sendEncryptedMessage(channelName, formattedMessage, BodyKind.message);
      return;
    }

    // Where the server can't refer to the message, the reply quotes it on a line of its own first
    if (replyTo !== undefined && replyTags(replyTo) === undefined) {
      sendPlainMessage(quoteLine(replyTo));
    }
    sendPlainMessage(formattedMessage, replyTo);
    clearReplyTo(channelName);
  };

  return (typed: string): SendResult => {
    if (typed.startsWith('/')) {
      return sendCommand(typed);
    }
    // Status and Debug take no chat messages: the text stays, for a command to be made of it
    if (isSystemChannel) {
      setAddMessage({
        id: uuidv4(),
        message: t('main.toolbar.noMessagesHere', { window: channelName }),
        target: channelName,
        time: new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
      return 'blocked';
    }
    sendChatMessage(typed);
    return 'sent';
  };
};
