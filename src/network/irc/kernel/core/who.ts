import { calculateMaxPermission } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { getUserModes } from '@features/settings/store/settings';
import { getHasUser, setAddUser, setUserAway, setUserHost, setUserRealname } from '@features/users/store/users';

const RPL_ENDOFWHO = '315';
const RPL_WHOSPCRPL = '354';

// :server 354 mynick querytype channel user host server nick flags hopcount :realname (WHOX reply)
export const onRaw354 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  ctx.line.shift(); // queryType
  const channel = ctx.line.shift();
  const ident = ctx.line.shift();
  const hostname = ctx.line.shift();
  ctx.line.shift(); // server
  const nick = ctx.line.shift();
  const flags = ctx.line.shift() ?? '';
  ctx.line.shift(); // hopcount
  const realname = ctx.trailing();

  if (!nick || !channel) { return; }

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
    setUserHost(nick, ident ?? '', hostname ?? '');
    if (realname) { setUserRealname(nick, realname); }
    if (isAway) { setUserAway(nick, true); }
  } else {
    setAddUser({
      nick,
      ident: ident ?? '',
      hostname: hostname ?? '',
      flags: [],
      channels: [{
        name: channel,
        flags: channelFlags,
        maxPermission: calculateMaxPermission(channelFlags, serverPrefixes),
      }],
    });
  }
};

export const onRaw315 = (): void => {
  // Ends the WHOX query sent on join; nothing to show
};

export const handlers: IrcHandlers = {
  [RPL_WHOSPCRPL]: onRaw354,
  [RPL_ENDOFWHO]: onRaw315,
};
