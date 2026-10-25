import i18next from '@/app/i18n';
import { clientSourceUrl, clientVersion, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext } from '@/network/irc/kernel/context';
import { addMessage } from '@/network/irc/kernel/replies';
import { ircSendRawMessage } from '@/network/irc/network';
import { setAddMessage, setIncreaseUnreadMessages } from '@features/channels/store/channels';
import { handleE2eeCtcp } from '@features/e2ee/incoming';
import { REPLY_TAG } from '@features/replies/replies';
import { getCurrentChannelName, getCurrentNick, isSameName } from '@features/settings/store/settings';
import { getUser } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import { announceHighlight, isHighlight, openConversationWindow, resolveConversation, trackReadPosition } from './conversation';

// CTCP: \x01COMMAND params\x01
export const handleCtcp = (ctx: IrcContext, nick: string, target: string, message: string): void => {
  const myNick = getCurrentNick();
  const currentChannelName = getCurrentChannelName();

  const ctcpContent = message.split('\x01').join('');

  const spaceIndex = ctcpContent.indexOf(' ');
  const ctcpCommand = spaceIndex !== -1 ? ctcpContent.substring(0, spaceIndex) : ctcpContent;
  const ctcpParams = spaceIndex !== -1 ? ctcpContent.substring(spaceIndex + 1) : '';

  if (ctcpCommand.toUpperCase() === 'ACTION') {
    handleCtcpAction(ctx, nick, target, ctcpParams, myNick, currentChannelName);
    return;
  }

  // Only live requests from others are acted on: a replayed one is stale, and our own are for someone else to answer
  if (ctx.isHistory || isSameName(nick, myNick)) {
    return;
  }

  // E2EE frames skip the CTCP notices, or every encrypted message would log a pair
  if (
    handleE2eeCtcp({
      nick,
      target,
      ctcpContent,
      source: 'privmsg',
      msgid: ctx.tags.msgid,
      time: ctx.tags.time,
    })
  ) {
    return;
  }

  let ctcpResponse: string;

  switch (ctcpCommand.toUpperCase()) {
    case 'VERSION':
      ctcpResponse = clientVersion;
      break;
    case 'TIME':
      ctcpResponse = new Date().toString();
      break;
    case 'PING': {
      // Prevents reflection abuse
      // eslint-disable-next-line no-control-regex
      ctcpResponse = ctcpParams.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 32);
      break;
    }
    case 'USERINFO':
      ctcpResponse = myNick;
      break;
    case 'SOURCE':
      ctcpResponse = clientSourceUrl;
      break;
    case 'CLIENTINFO':
      // Advertised so peers can detect E2EE support without a speculative offer
      ctcpResponse = 'ACTION VERSION TIME PING USERINFO SOURCE CLIENTINFO SIC-E2EE';
      break;
    default:
      return;
  }

  ctcpReply(nick, ctcpCommand.toUpperCase(), ctcpResponse);

  const command = ctcpCommand.toUpperCase();

  // In Status, to avoid noise in channels
  setAddMessage({
    id: uuidv4(),
    message: i18next.t('kernel.ctcpRequest', { nick, command }),
    target: STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.notice,
    color: MessageColor.notice,
  });

  setAddMessage({
    id: uuidv4(),
    message: i18next.t('kernel.ctcpResponse', { nick, command, response: ctcpResponse }),
    target: STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.notice,
    color: MessageColor.notice,
  });
};

export const ctcpReply = (target: string, command: string, response: string): void => {
  ircSendRawMessage(`NOTICE ${target} :\x01${command} ${response}\x01`);
};

export const handleCtcpAction = (
  ctx: IrcContext,
  nick: string,
  target: string,
  action: string,
  myNick: string,
  currentChannelName: string
): void => {
  const conversation = resolveConversation(nick, target, myNick);
  openConversationWindow(conversation);
  const { window, isOwn } = conversation;

  if (window !== currentChannelName && !ctx.isHistory && !isOwn) {
    setIncreaseUnreadMessages(window);
  }

  const highlight = isHighlight(conversation, action, myNick);

  addMessage(ctx, {
    id: ctx.tags.msgid ?? uuidv4(),
    msgid: ctx.tags.msgid,
    replyTo: ctx.tags[REPLY_TAG],
    message: action,
    nick: getUser(nick) ?? nick,
    target: window,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.me,
    color: MessageColor.me,
    highlight,
  });
  trackReadPosition(ctx, window, currentChannelName);

  if (highlight && !ctx.isHistory) {
    announceHighlight(conversation, nick, action, currentChannelName);
  }
};
