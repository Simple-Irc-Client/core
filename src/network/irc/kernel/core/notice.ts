import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { isIrcService, parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addMessage } from '@/network/irc/kernel/replies';
import { ircAutoAuthenticate } from '@/network/irc/network';
import { serviceRequestWindow } from '@/network/irc/serviceRequests';
import { getAlisMode, setAddChannelToList, setAlisMode, setChannelListFinished, setListDeprecated } from '@features/channels/store/channelList';
import { existChannel, isChannel, setAddMessage } from '@features/channels/store/channels';
import { handleE2eeCtcp } from '@features/e2ee/incoming';
import { isIgnoredSender } from '@features/ignore/ignore';
import { getConnectedTime, getCurrentChannelName, getCurrentNick, getEncryptedPassword, getIsWizardCompleted, getPasswordNick, getUserModes, isSameName, setIsPasswordRequired, setListRequestRemainingSeconds, setWizardStep } from '@features/settings/store/settings';
import { setUserBot } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// @draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...
// :insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above
// :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~
// @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/
// :irc.librairc.net NOTICE SIC-test :*** You cannot list within the first 60 seconds of connecting. Please try again later.
// A bot's or ChanServ's channel greeting, sent to us: "[#channel] Welcome!"
const CHANNEL_PREFIX = /^\[(\S+)\] /;

const shownWindow = (window: string | undefined): string | undefined => (window !== undefined && existChannel(window) ? window : undefined);

/**
 * A notice to a channel, or about one, goes to that channel. Services talk to us unasked when we connect
 * and identify, so theirs go to Status unless they answer something the user wrote from a window.
 * Any other notice to us goes to the current window (classic IRC behavior).
 */
const noticeWindow = (ctx: IrcContext, nick: string, target: string, message: string, isServerNotice: boolean, currentChannelName: string): string => {
  if (isServerNotice) {
    return STATUS_CHANNEL;
  }
  if (isChannel(target) && existChannel(target)) {
    return target;
  }
  const mentioned = CHANNEL_PREFIX.exec(message)?.[1];
  const greetedIn = mentioned !== undefined && isChannel(mentioned) ? shownWindow(mentioned) : undefined;
  if (greetedIn !== undefined) {
    return greetedIn;
  }
  if (isIrcService(nick)) {
    return shownWindow(ctx.request?.window ?? serviceRequestWindow(nick)) ?? STATUS_CHANNEL;
  }
  return currentChannelName;
};

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

  if (!ctx.isHistory && isSameName(nick, 'NickServ') && isSameName(target, getCurrentNick()) && passwordRequired.test(message)) {
    setIsPasswordRequired(true);
    // Auto-identify with the saved password for this nick
    if (getIsWizardCompleted() && getEncryptedPassword() && isSameName(getPasswordNick() ?? '', getCurrentNick())) {
      void ircAutoAuthenticate();
    } else {
      setWizardStep('password');
    }
  }

  if (!ctx.isHistory && list.test(message) && isSameName(target, getCurrentNick())) {
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

  if (isIgnoredSender(ctx.sender)) {
    return;
  }

  // Handle CTCP replies (NOTICE with \x01 delimiters)
  if (message.startsWith('\x01')) {
    // Only show live CTCP replies addressed to us; replayed ones answer requests long gone
    if (ctx.isHistory || !isSameName(target, getCurrentNick())) {
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

  const noticeTarget = noticeWindow(ctx, nick, target, message, isServerNotice, currentChannelName);

  const newMessage = {
    message,
    nick: nick.length !== 0 ? nick : undefined,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.notice,
    color: MessageColor.notice,
  };

  addMessage(ctx, { ...newMessage, target: noticeTarget, id: ctx.tags.msgid ?? uuidv4() });
};

export const handlers: IrcHandlers = {
  NOTICE: onNotice,
};
