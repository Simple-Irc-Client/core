import i18next from '@/app/i18n';
import { clientSourceUrl, clientVersion, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { ircAutoAuthenticate, ircSendRawMessage } from '@/network/irc/network';
import { notifyHighlight } from '@/runtime/notifications';
import { addAwayMessage } from '@features/channels/store/awayMessages';
import { getAlisMode, setAddChannelToList, setAlisMode, setChannelListFinished, setListDeprecated } from '@features/channels/store/channelList';
import { existChannel, isChannel, setAddChannel, setAddMessage, setHasMention, setIncreaseUnreadMessages, setTyping } from '@features/channels/store/channels';
import { subscribeDmPresence } from '@features/dmPresence/dmPresence';
import { handleE2eeCtcp } from '@features/e2ee/incoming';
import { handlePeerOffline } from '@features/e2ee/session';
import { getConnectedTime, getCurrentChannelName, getCurrentNick, getCurrentUserFlags, getEncryptedPassword, getIsWizardCompleted, getPasswordNick, getUserModes, isSameName, setIsPasswordRequired, setListRequestRemainingSeconds, setWizardStep } from '@features/settings/store/settings';
import { getUser, setUserBot } from '@features/users/store/users';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const ERR_NOSUCHNICK = '401';
const ERR_CANNOTSENDTOCHAN = '404';
const ERR_NORECIPIENT = '411';
const ERR_NOTEXTTOSEND = '412';

// @draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...
// :insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above
// :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~
// @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/
// :irc.librairc.net NOTICE SIC-test :*** You cannot list within the first 60 seconds of connecting. Please try again later.
export const onNotice = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();

  const passwordRequired = /^(This nickname is registered|Ten nick jest zarejestrowany i chroniony)/;
  const list = /You have to be connected for at least (?<secs1>\d+) seconds before being able to \/LIST|You cannot list within the first (?<secs2>\d+) seconds of connecting|This server requires that you wait (?<secs3>\d+)s after connecting before you can use \/LIST/;

  const target = ctx.line.shift();

  if (target === undefined) {
    ctx.logParseError(onNotice, 'target');
    return;
  }

  const message = ctx.trailing();

  const { nick } = parseNick(ctx.sender, getUserModes());

  if ('draft/bot' in ctx.tags || 'bot' in ctx.tags) {
    setUserBot(nick, true);
  }

  if (isSameName(nick, 'NickServ') && isSameName(target, getCurrentNick()) && passwordRequired.test(message)) {
    setIsPasswordRequired(true);
    // Auto-identify with the saved password for this nick
    if (getIsWizardCompleted() && getEncryptedPassword() && isSameName(getPasswordNick() ?? '', getCurrentNick())) {
      void ircAutoAuthenticate();
    } else {
      setWizardStep('password');
    }
  }

  if (list.test(message) && isSameName(target, getCurrentNick())) {
    const regexpGroups = list.exec(message)?.groups;
    const seconds = regexpGroups?.secs1 ?? regexpGroups?.secs2 ?? regexpGroups?.secs3;

    const connectedTime = getConnectedTime();
    if (seconds !== undefined && connectedTime !== 0) {
      const currentTime = Math.floor(Date.now() / 1000);
      const loggedTime = currentTime - connectedTime;
      const remaining = loggedTime > Number(seconds) ? 0 : Number(seconds) - loggedTime;
      setListRequestRemainingSeconds(remaining);
    }
    return;
  }

  // IRCnet LIST deprecation — mark for potential Alis fallback at end of LIST
  if (/Usage of \/list for listing all channels is deprecated/i.test(message)) {
    setListDeprecated(true);
    return;
  }

  // Parse Alis NOTICE responses when in alisMode
  // Alis sends as "Alis@hub.uk" (no !user part)
  if (/^alis[@!]/i.test(nick) && getAlisMode()) {
    // Format: "#channel                    \x02 42\x02: topic"
    // eslint-disable-next-line no-control-regex
    const channelLine = /^(#\S*)\s+\x02\s*(\d+)\x02:\s?(.*)/;
    const footer = /^found \d+ visible channels/i;

    const channelMatch = channelLine.exec(message);
    if (channelMatch && channelMatch[1]) {
      setAddChannelToList(channelMatch[1], Number(channelMatch[2]), channelMatch[3] ?? '');
      return;
    }

    if (footer.test(message)) {
      setChannelListFinished(true);
      setAlisMode(false);
      return;
    }

    // Header or other Alis lines — skip silently
    return;
  }

  // Handle CTCP replies (NOTICE with \x01 delimiters)
  if (message.startsWith('\x01')) {
    // Only show CTCP replies addressed to us
    if (!isSameName(target, getCurrentNick())) {
      return;
    }

    const ctcpContent = message.split('\x01').join('');

    // E2EE handshake replies (ACCEPT/DECLINE/RESET) arrive as CTCP replies by
    // convention; they drive the session, not the Status window.
    if (handleE2eeCtcp({ nick, target, ctcpContent, source: 'notice', msgid: ctx.tags.msgid, time: ctx.tags.time })) {
      return;
    }

    const spaceIndex = ctcpContent.indexOf(' ');
    const ctcpCommand = spaceIndex !== -1 ? ctcpContent.substring(0, spaceIndex) : ctcpContent;
    const ctcpResponse = spaceIndex !== -1 ? ctcpContent.substring(spaceIndex + 1) : '';

    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.ctcpReply', { nick, command: ctcpCommand.toUpperCase(), response: ctcpResponse }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.notice,
      color: MessageColor.notice,
    });
    return;
  }

  // Server notices (sender has no '!' — it's a server hostname, not a user)
  // route to Status to avoid flooding the current channel during connection/reconnection
  const isServerNotice = !ctx.sender.includes('!');

  // Notices addressed to a channel we have open belong in that channel's window;
  // notices addressed to us go to the current window (classic IRC behavior)
  let noticeTarget = currentChannelName;
  if (isServerNotice) {
    noticeTarget = STATUS_CHANNEL;
  } else if (isChannel(target) && existChannel(target)) {
    noticeTarget = target;
  }

  const newMessage = {
    message,
    nick: nick.length !== 0 ? nick : undefined,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.notice,
    color: MessageColor.notice,
  };

  setAddMessage({ ...newMessage, target: noticeTarget, id: ctx.tags.msgid ?? uuidv4() });
};

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

  if ('draft/bot' in ctx.tags || 'bot' in ctx.tags) {
    setUserBot(nick, true);
  }

  if (message.startsWith('\x01')) {
    handleCtcp(ctx, nick, target, message);
    return;
  }

  // IRCv3 echo-message: the server's msgid and time give accurate ordering
  const isEchoMessage = isSameName(nick, myNick) && isCapabilityEnabled('echo-message');

  const IRC_SERVICES = ['nickserv', 'chanserv', 'memoserv', 'hostserv', 'botserv', 'operserv', 'global', 'saslserv'];
  const isServiceTarget = IRC_SERVICES.includes(target.toLowerCase());

  // Echoed messages to services may contain passwords
  if (isEchoMessage && isServiceTarget) {
    return;
  }

  // A direct message is either addressed to us, or is our own echoed message to a non-channel target
  const isDirectMessage = isSameName(target, myNick) || (isSameName(nick, myNick) && !isChannel(target));
  const messageTarget = isSameName(target, myNick) ? nick : target;

  if (!existChannel(messageTarget)) {
    setAddChannel(messageTarget, isDirectMessage ? ChannelCategory.priv : ChannelCategory.channel);
    if (isDirectMessage) {
      subscribeDmPresence(messageTarget);
    }
  }

  if (messageTarget !== currentChannelName && !isEchoMessage) {
    setIncreaseUnreadMessages(messageTarget);
  }

  if (isSameName(messageTarget, currentChannelName) && !isEchoMessage) {
    setTyping(messageTarget, nick, 'done');
  }

  const messageId = ctx.tags.msgid ?? uuidv4();
  const messageTime = ctx.tags.time ?? new Date().toISOString();
  const highlight = !isEchoMessage && (isDirectMessage || message.toLowerCase().includes(myNick.toLowerCase()));

  setAddMessage({
    id: messageId,
    message,
    nick: getUser(nick) ?? nick,
    target: messageTarget,
    time: messageTime,
    category: MessageCategory.default,
    color: MessageColor.default,
    echoed: isEchoMessage,
    highlight,
  });

  if (highlight && messageTarget !== currentChannelName) {
    setHasMention(messageTarget);
  }

  if (highlight) {
    void notifyHighlight({ nick, target: messageTarget, message, isDirect: isDirectMessage });
  }

  if (!isEchoMessage) {
    const userFlags = getCurrentUserFlags();
    const isAway = userFlags.includes('away');
    if (isAway && message.toLowerCase().includes(myNick.toLowerCase())) {
      addAwayMessage({
        id: messageId,
        message,
        nick: getUser(nick) ?? nick,
        target: messageTarget,
        time: messageTime,
        category: MessageCategory.default,
        color: MessageColor.default,
        channel: messageTarget,
      });
    }
  }
};

// CTCP: \x01COMMAND params\x01
export const handleCtcp = (ctx: IrcContext, nick: string, target: string, message: string): void => {
  const myNick = getCurrentNick();
  const currentChannelName = getCurrentChannelName();

  const ctcpContent = message.split('\x01').join('');

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

  const spaceIndex = ctcpContent.indexOf(' ');
  const ctcpCommand = spaceIndex !== -1 ? ctcpContent.substring(0, spaceIndex) : ctcpContent;
  const ctcpParams = spaceIndex !== -1 ? ctcpContent.substring(spaceIndex + 1) : '';

  let ctcpResponse: string;

  switch (ctcpCommand.toUpperCase()) {
    case 'ACTION':
      handleCtcpAction(ctx, nick, target, ctcpParams, myNick, currentChannelName);
      return;
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
  const isEchoMessage = isSameName(nick, myNick) && isCapabilityEnabled('echo-message');
  // A direct message is either addressed to us, or is our own echoed action to a non-channel target
  const isDirectMessage = isSameName(target, myNick) || (isSameName(nick, myNick) && !isChannel(target));
  const messageTarget = isSameName(target, myNick) ? nick : target;

  if (!existChannel(messageTarget)) {
    setAddChannel(messageTarget, isDirectMessage ? ChannelCategory.priv : ChannelCategory.channel);
    if (isDirectMessage) {
      subscribeDmPresence(messageTarget);
    }
  }

  if (messageTarget !== currentChannelName && !isEchoMessage) {
    setIncreaseUnreadMessages(messageTarget);
  }

  const highlight = !isEchoMessage && (isDirectMessage || action.toLowerCase().includes(myNick.toLowerCase()));

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: action,
    nick: getUser(nick) ?? nick,
    target: messageTarget,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.me,
    color: MessageColor.me,
    highlight,
  });

  if (highlight && messageTarget !== currentChannelName) {
    setHasMention(messageTarget);
  }

  if (highlight) {
    void notifyHighlight({ nick, target: messageTarget, message: action, isDirect: isDirectMessage });
  }
};

// :server 401 mynick target :No such nick/channel
export const onRaw401 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const target = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'No such nick/channel') {
    message = i18next.t('kernel.401.no-such-nick-channel', { defaultValue: message });
  }

  if (target) {
    // Fail a pending E2EE offer now rather than after its timeout
    handlePeerOffline(target);
  }

  addReply(ctx, {
    message: `${target}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 404 mynick #channel :Cannot send to channel
export const onRaw404 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Cannot send to channel') {
    message = i18next.t('kernel.404.cannot-send-to-channel', { defaultValue: message });
  }

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: channel ?? STATUS_CHANNEL,
    category: MessageCategory.error,
  });
};

// :server 411 mynick :No recipient given
export const onRaw411 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 412 mynick :No text to send
export const onRaw412 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  let message = ctx.trailing();

  if (message === 'No text to send') {
    message = i18next.t('kernel.412.no-text-to-send', { defaultValue: message });
  }

  addReply(ctx, {
    message,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

export const handlers: IrcHandlers = {
  NOTICE: onNotice,
  PRIVMSG: onPrivMsg,
  [ERR_NOSUCHNICK]: onRaw401,
  [ERR_CANNOTSENDTOCHAN]: onRaw404,
  [ERR_NORECIPIENT]: onRaw411,
  [ERR_NOTEXTTOSEND]: onRaw412,
};
