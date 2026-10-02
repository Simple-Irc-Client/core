import { calculateMaxPermission } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { ircSendRawMessage } from '@/network/irc/network';
import { getCaseMapping, getCurrentChannelName, getUserModes, isSupportedOption } from '@features/settings/store/settings';
import { getHasUser, setAddUser, setUserAccount, setUserAway, setUserHost, setUserRealname } from '@features/users/store/users';
import { foldName } from '@shared/lib/caseMapping';
import { MessageCategory } from '@shared/types';

const RPL_ENDOFWHO = '315';
const RPL_WHOREPLY = '352';
const RPL_WHOSPCRPL = '354';

/** Tags the WHOX replies to our own query, so a WHOX typed by the user is not mistaken for it */
const WHOX_QUERY_TYPE = '152';

/** Channels with a WHO we sent ourselves (folded); their replies update users instead of being shown. */
const ownWhoRequests = new Set<string>();

const isOwnWhoRequest = (channel: string): boolean => ownWhoRequests.has(foldName(channel, getCaseMapping()));

/** Fetches host, realname, away status (and account, with WHOX) of everyone in a channel we joined. */
export const requestChannelWho = (channel: string): void => {
  ownWhoRequests.add(foldName(channel, getCaseMapping()));
  ircSendRawMessage(isSupportedOption('WHOX') ? `WHO ${channel} %chtsunfra,${WHOX_QUERY_TYPE}` : `WHO ${channel}`);
};

/** Replies to requests from a previous connection never arrive. */
export const clearChannelWhoRequests = (): void => {
  ownWhoRequests.clear();
};

interface WhoReply {
  channel: string;
  nick: string;
  ident: string;
  hostname: string;
  flags: string;
  realname: string;
  /** WHOX only; "0" = not logged in */
  account?: string;
}

const applyWhoReply = ({ channel, nick, ident, hostname, flags, realname, account }: WhoReply): void => {
  const serverPrefixes = getUserModes();

  // Parse flags to extract user modes (H=here, G=gone/away, *=oper, @%+ = channel modes)
  const channelFlags: string[] = [];
  let isAway = false;

  for (const flag of flags.split('')) {
    if (flag === 'G') {
      isAway = true;
    } else if (serverPrefixes.some(p => p.symbol === flag)) {
      channelFlags.push(flag);
    }
  }

  if (getHasUser(nick)) {
    setUserHost(nick, ident, hostname);
  } else {
    setAddUser({
      nick,
      ident,
      hostname,
      flags: [],
      channels: [{
        name: channel,
        flags: channelFlags,
        maxPermission: calculateMaxPermission(channelFlags, serverPrefixes),
      }],
    });
  }

  if (realname) { setUserRealname(nick, realname); }
  if (isAway) { setUserAway(nick, true); }
  if (account !== undefined) { setUserAccount(nick, account === '0' ? null : account); }
};

/** A reply to a WHO the user typed, shown where they typed it */
const showWhoLine = (ctx: IrcContext): void => {
  showReply(ctx, {
    message: ctx.paramsWithText(),
    target: getCurrentChannelName(),
    category: MessageCategory.info,
  });
};

// :server 352 mynick #channel ident host server nick flags :hopcount realname
export const onRaw352 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line[0];

  if (channel === undefined || !isOwnWhoRequest(channel)) {
    showWhoLine(ctx);
    return;
  }

  ctx.line.shift(); // channel
  const ident = ctx.line.shift();
  const hostname = ctx.line.shift();
  ctx.line.shift(); // server
  const nick = ctx.line.shift();
  const flags = ctx.line.shift() ?? '';
  const realname = ctx.trailing().replace(/^\d+ ?/, ''); // hopcount

  if (!nick) {
    ctx.logParseError(onRaw352, 'nick');
    return;
  }

  applyWhoReply({ channel, nick, ident: ident ?? '', hostname: hostname ?? '', flags, realname });
};

// :server 354 mynick 152 #channel ident host server nick flags account :realname (reply to WHO %chtsunfra,152)
export const onRaw354 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  if (ctx.line[0] !== WHOX_QUERY_TYPE) {
    showWhoLine(ctx);
    return;
  }

  ctx.line.shift(); // queryType
  const channel = ctx.line.shift();
  const ident = ctx.line.shift();
  const hostname = ctx.line.shift();
  ctx.line.shift(); // server
  const nick = ctx.line.shift();
  const flags = ctx.line.shift() ?? '';
  const account = ctx.line.shift();
  const realname = ctx.trailing();

  if (!nick || !channel) { return; }

  applyWhoReply({ channel, nick, ident: ident ?? '', hostname: hostname ?? '', flags, realname, account });
};

// :server 315 mynick #channel :End of WHO list
export const onRaw315 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const target = ctx.line[0];

  if (target !== undefined && isOwnWhoRequest(target)) {
    ownWhoRequests.delete(foldName(target, getCaseMapping()));
    return;
  }

  showWhoLine(ctx);
};

export const handlers: IrcHandlers = {
  [RPL_ENDOFWHO]: onRaw315,
  [RPL_WHOREPLY]: onRaw352,
  [RPL_WHOSPCRPL]: onRaw354,
};
