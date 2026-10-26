import { MessageColor } from '@/config/theme';
import { parseNick, isIrcService } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addMessage } from '@/network/irc/kernel/replies';
import { addAwayMessage } from '@features/channels/store/awayMessages';
import { setIncreaseUnreadMessages, setTyping } from '@features/channels/store/channels';
import { REPLY_TAG } from '@features/replies/replies';
import { isIgnoredSender } from '@features/ignore/ignore';
import { getUser, setUserBot } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import { announceHighlight, isHighlight, mentionsMe, openConversationWindow, resolveConversation, trackReadPosition } from './conversation';
import { handleCtcp } from './ctcp';
import { getCurrentChannelName, getCurrentNick, getCurrentUserFlags, getUserModes, isSameName } from '@features/networks/store/networks';

// @batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1
// @msgid=HPS1IK0ruo8t691kVDRtFl;time=2023-02-12T02:11:26.770Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 4
// @draft/bot;msgid=GQRN0k0RNmLY3Ai6f9g6Qk;time=2023-03-23T15:32:56.299Z :Global!Global@serwisy.pirc.pl PRIVMSG sic-test :VERSION
export const onPrivMsg = (ctx: IrcContext): void => {
  const serverUserModes = getUserModes();
  const currentChannelName = getCurrentChannelName();
  const myNick = getCurrentNick();

  const target = ctx.line.shift();
  const message = ctx.trailing();
  const { nick } = parseNick(ctx.sender, serverUserModes);

  if (target === undefined) {
    ctx.logParseError(onPrivMsg, 'target');
    return;
  }

  if (isIgnoredSender(ctx.sender)) {
    return;
  }

  if ('draft/bot' in ctx.tags || 'bot' in ctx.tags) {
    setUserBot(nick, true);
  }

  if (message.startsWith('\x01')) {
    handleCtcp(ctx, nick, target, message);
    return;
  }

  const conversation = resolveConversation(nick, target, myNick);

  if (conversation.isOwn && isIrcService(target)) {
    return;
  }

  openConversationWindow(conversation);
  const { window, isOwn, isEcho } = conversation;
  const isLiveFromOthers = !ctx.isHistory && !isOwn;

  if (window !== currentChannelName && isLiveFromOthers) {
    setIncreaseUnreadMessages(window);
  }

  if (isSameName(window, currentChannelName) && isLiveFromOthers) {
    setTyping(window, nick, 'done');
  }

  // With echo-message, the server's msgid and time give accurate ordering
  const messageId = ctx.tags.msgid ?? uuidv4();
  const messageTime = ctx.tags.time ?? new Date().toISOString();
  const highlight = isHighlight(conversation, message, myNick);

  addMessage(ctx, {
    id: messageId,
    msgid: ctx.tags.msgid,
    replyTo: ctx.tags[REPLY_TAG],
    message,
    nick: getUser(nick) ?? nick,
    target: window,
    time: messageTime,
    category: MessageCategory.default,
    color: MessageColor.default,
    echoed: isEcho,
    highlight,
  });
  trackReadPosition(ctx, window, currentChannelName);

  if (highlight && !ctx.isHistory) {
    announceHighlight(conversation, nick, message, currentChannelName);
  }

  if (isLiveFromOthers) {
    const userFlags = getCurrentUserFlags();
    const isAway = userFlags.includes('away');
    if (isAway && mentionsMe(message, myNick)) {
      addAwayMessage({
        id: messageId,
        message,
        nick: getUser(nick) ?? nick,
        target: window,
        time: messageTime,
        category: MessageCategory.default,
        color: MessageColor.default,
        channel: window,
      });
    }
  }
};

export const handlers: IrcHandlers = {
  PRIVMSG: onPrivMsg,
};
