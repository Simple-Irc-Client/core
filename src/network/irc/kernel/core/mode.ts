import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { channelModeType, parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addToChannelSettingsBanList, addToChannelSettingsExceptionList, addToChannelSettingsInviteList, removeFromChannelSettingsBanList, removeFromChannelSettingsExceptionList, removeFromChannelSettingsInviteList, setChannelSettingsIsBanListLoading, setChannelSettingsIsExceptionListLoading, setChannelSettingsIsInviteListLoading, setChannelSettingsIsLoading, setChannelSettingsModes, updateChannelSettingsMode, useChannelSettingsStore } from '@features/channels/store/channelSettings';
import { isChannel, setAddMessage } from '@features/channels/store/channels';
import { getChannelModes, getCurrentChannelName, getCurrentNick, getUserModes, isSameName, setCurrentUserFlag } from '@features/settings/store/settings';
import { setUpdateUserFlag, setUserBot } from '@features/users/store/users';
import { getDateFnsLocale } from '@shared/lib/dateLocale';
import { MessageCategory } from '@shared/types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const RPL_UMODEIS = '221';
const RPL_CHANNELMODEIS = '324';
const RPL_CREATIONTIME = '329';
const RPL_INVITELIST = '346';
const RPL_ENDOFINVITELIST = '347';
const RPL_EXCEPTLIST = '348';
const RPL_ENDOFEXCEPTLIST = '349';
const RPL_BANLIST = '367';
const RPL_ENDOFBANLIST = '368';
const ERR_UNKNOWNMODE = '472';
const ERR_BANLISTFULL = '478';
const ERR_CHANOPRIVSNEEDED = '482';
const ERR_UMODEUNKNOWNFLAG = '501';
const ERR_USERSDONTMATCH = '502';

// @draft/bot;msgid=TAwD3gzM6wZJulwi2hI0Ki;time=2023-03-04T19:13:32.450Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +h Merovingian
// @account=PEPSISEXIBOMBA;msgid=c97PqlwAZZ8m2aRhCPMl8O;time=2023-03-19T20:35:06.649Z :PEPSISEXIBOMBA!~yooz@cloak:PEPSISEXIBOMBA MODE #Religie +b *!*@ukryty-D5702E9C.dip0.t-ipconnect.de
// @draft/bot;msgid=g3x5HMBRj88mm32ndwtaUp;time=2023-03-19T21:08:35.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +v rupert__
// :Merovingian MODE Merovingian :+x
// :mero MODE mero :+xz
// :mero-test MODE mero-test :+i
// @draft/bot;msgid=zAfMgqBIJHiIfUCpDbbUfm;time=2023-03-27T23:49:47.290Z :ChanServ!ChanServ@serwisy.pirc.pl MODE #sic +qo Merovingian Merovingian
// @account=Merovingian;msgid=Mo53vHEaXcEELccHhGfuVA;time=2023-03-27T23:52:26.726Z :Merovingian!~pirc@cloak:Merovingian MODE #sic +l 99
export const onMode = (ctx: IrcContext): void => {
  const serverChannelModes = getChannelModes();
  const serverUserModes = getUserModes();

  const { nick } = parseNick(ctx.sender, serverUserModes);

  const userOrChannel = ctx.line.shift();

  if (userOrChannel === undefined) {
    ctx.logParseError(onMode, 'userOfChannel');
    return;
  }

  let flags = ctx.line.shift() ?? '';
  if (flags.startsWith(':')) {
    flags = flags.substring(1);
  }

  if (isChannel(userOrChannel)) {
    // channel mode
    const channel = userOrChannel;

    let plusMinus: '+' | '-' | undefined;

    let flagParameterIndex = 0;
    const flagsList = flags.split('');
    for (const flag of flagsList) {
      if (flag === '+') {
        plusMinus = '+';
      }
      if (flag === '-') {
        plusMinus = '-';
      }

      if (flag === '+' || flag === '-' || plusMinus === undefined) {
        continue; // set flag
      }

      const mode = `${plusMinus}${flag}`;
      const type = channelModeType(flag, serverChannelModes, serverUserModes);

      let message = '';
      const translate = `kernel.mode.channel.${plusMinus === '+' ? 'plus' : 'minus'}.${flag}`;

      const settingsChannel = useChannelSettingsStore.getState().channelName;
      const isSettingsOpen = settingsChannel === channel;

      switch (`${plusMinus}${type ?? ''}`) {
        case '+A':
        case '-A': {
          // List modes (ban, exception, invite) always have a param
          const param = ctx.line[flagParameterIndex];
          flagParameterIndex++;
          message = i18next.t(translate, { channel, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.unknown-params', { channel, setBy: nick, mode, param }) });
          if (isSettingsOpen && param) {
            if (plusMinus === '+') {
              const entry = { mask: param, setBy: nick, setTime: Math.floor(Date.now() / 1000) };
              if (flag === 'b') { addToChannelSettingsBanList(entry); }
              else if (flag === 'e') { addToChannelSettingsExceptionList(entry); }
              else if (flag === 'I') { addToChannelSettingsInviteList(entry); }
            } else {
              if (flag === 'b') { removeFromChannelSettingsBanList(param); }
              else if (flag === 'e') { removeFromChannelSettingsExceptionList(param); }
              else if (flag === 'I') { removeFromChannelSettingsInviteList(param); }
            }
          }
          break;
        }
        case '+B':
        case '-B':
        case '+C': {
          // with params
          const param = ctx.line[flagParameterIndex];
          flagParameterIndex++;
          message = i18next.t(translate, { channel, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.unknown-params', { channel, setBy: nick, mode, param }) });
          if (isSettingsOpen) {
            if (plusMinus === '+') {
              updateChannelSettingsMode(flag, param ?? true);
            } else {
              updateChannelSettingsMode(flag, null);
            }
          }
          break;
        }
        case '-C':
        case '+D':
        case '-D':
          // single
          message = i18next.t(translate, { channel, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.unknown', { channel, setBy: nick, mode }) });
          if (isSettingsOpen) {
            updateChannelSettingsMode(flag, plusMinus === '+' ? true : null);
          }
          break;
        case '+U':
        case '-U': {
          // user flag
          const user = ctx.line[flagParameterIndex];
          if (user !== undefined) {
            flagParameterIndex++;
            message = i18next.t(translate, { user, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.user', { user, setBy: nick, mode }) });
            setUpdateUserFlag(user, channel, plusMinus, flag, serverUserModes);
          }
          break;
        }
        default:
          message = i18next.t('kernel.mode.channel.unknown', { channel, setBy: nick, mode });
          if (import.meta.env.DEV) { console.log(`unknown mode: ${mode} / ${ctx.eventLine}`); }
          break;
      }

      setAddMessage({
        id: uuidv4(),
        message,
        target: userOrChannel,
        time: ctx.tags.time ?? new Date().toISOString(),
        category: MessageCategory.mode,
        color: MessageColor.mode,
      });
    }
  } else {
    // user mode
    const user = userOrChannel;

    let plusMinus: '+' | '-' | undefined;

    const flagsList = flags.split('');
    for (const flag of flagsList) {
      if (flag === '+') {
        plusMinus = '+';
      }
      if (flag === '-') {
        plusMinus = '-';
      }

      if (flag === '+' || flag === '-' || plusMinus === undefined) {
        continue; // set flag
      }

      const mode = `${plusMinus}${flag}`;
      const translate = `kernel.mode.user.${plusMinus === '+' ? 'plus' : 'minus'}.${flag}`;
      const defaultMessage = i18next.t('kernel.mode.user.unknown', { user, setBy: nick, mode });

      // https://docs.inspircd.org/4/user-modes/
      switch (flag) {
        case 'B': // Marks the user as a bot.
          setUserBot(user, plusMinus === '+');
          break;
        case 'i': // RFC 1459: Invisible - hides user from /who and /whois by non-opers.
        case 'w': // RFC 1459: Wallops - receives wallops messages.
        case 'o': // RFC 1459: Operator - marks the user as an IRC operator.
        case 's': // RFC 1459: Server notices - receives server notices.
        case 'c': // Requires other users to have a common channel before they can message this user.
        case 'd': // Prevents the user from receiving channel messages.
        case 'D': // Prevents the user from receiving private messages.
        case 'G': // Enables censoring messages sent to the user.
        case 'g': // Enables whitelisting of who can message the user.
        case 'H': // Hides the user's server operator status from unprivileged users.
        case 'h': // Marks the user as being available for help.
        case 'I': // Hides the channels the user is in from their /WHOIS response.
        case 'k': // Protects services pseudoclients against kicks, kills, and channel prefix mode changes.
        case 'L': // Prevents users from being redirected by channel mode L (redirect).
        case 'N': // Disables receiving channel history on join.
        case 'O': // Allows server operators to opt-in to overriding restrictions.
        case 'R': // Prevents users who are not logged into a services account from messaging the user.
        case 'r': // Marks the user as being logged into a services account.
        case 'S': // Enables stripping of IRC formatting codes from private messages.
        case 'T': // Enables blocking private messages that contain CTCPs.
        case 'W': // Informs the user when someone does a /WHOIS query on their nick.
        case 'x': // Enables hiding of the user's hostname.
        case 'y': // Marks the user as a WHOIS snooper.
        case 'q': // Only U-lined servers can kick (services protection).
        case 'a': // Services administrator.
        case 'v': // Receives informed about bad DCC/CTCP requests.
        case 'z': // Prevents messages from being sent to or received from a user that is not connected using TLS (SSL).
          break;
        default:
          if (import.meta.env.DEV) { console.log(`unknown mode: ${mode} / ${ctx.eventLine}`); }
          break;
      }
      const message = i18next.t(translate, { user, setBy: nick, defaultValue: defaultMessage });

      if (flag === 'r' && isSameName(user, getCurrentNick())) {
        setCurrentUserFlag('r', plusMinus === '+');
      }

      // To Status, to avoid noise in channels
      setAddMessage({
        id: uuidv4(),
        message,
        target: STATUS_CHANNEL,
        time: ctx.tags.time ?? new Date().toISOString(),
        category: MessageCategory.mode,
        color: MessageColor.mode,
      });
    }
  }
};

// :server 324 mynick #channel +tnl 50
// :chmurka.pirc.pl 324 sic-test #sic +nt
export const onRaw324 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let modesString = ctx.line.shift() ?? '';

  if (channel === undefined) {
    return;
  }

  const settingsChannel = useChannelSettingsStore.getState().channelName;
  if (settingsChannel !== channel) {
    return;
  }

  const modes: Record<string, string | boolean> = {};
  const serverChannelModes = getChannelModes();

  if (modesString.startsWith('+')) {
    modesString = modesString.substring(1);
  }

  let paramIndex = 0;
  for (const flag of modesString.split('')) {
    const type = channelModeType(flag, serverChannelModes, getUserModes());

    if (type === 'B' || type === 'C') {
      const param = ctx.line[paramIndex];
      if (param !== undefined) {
        modes[flag] = param;
        paramIndex++;
      }
    } else if (type === 'D') {
      modes[flag] = true;
    }
  }

  setChannelSettingsModes(modes);
  setChannelSettingsIsLoading(false);
};

// :server 346 mynick #channel mask!*@* setter 1234567890
export const onRaw346 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const mask = ctx.line.shift();
  const setBy = ctx.line.shift() ?? '';
  const setTime = Number(ctx.line.shift() ?? '0');

  if (channel === undefined || mask === undefined) {
    return;
  }

  const settingsChannel = useChannelSettingsStore.getState().channelName;
  if (settingsChannel !== channel) {
    return;
  }

  addToChannelSettingsInviteList({ mask, setBy, setTime });
};

// :server 347 mynick #channel :End of Channel Invite List
export const onRaw347 = (): void => {
  setChannelSettingsIsInviteListLoading(false);
};

// :server 348 mynick #channel mask!*@* setter 1234567890
export const onRaw348 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const mask = ctx.line.shift();
  const setBy = ctx.line.shift() ?? '';
  const setTime = Number(ctx.line.shift() ?? '0');

  if (channel === undefined || mask === undefined) {
    return;
  }

  const settingsChannel = useChannelSettingsStore.getState().channelName;
  if (settingsChannel !== channel) {
    return;
  }

  addToChannelSettingsExceptionList({ mask, setBy, setTime });
};

// :server 349 mynick #channel :End of Channel Exception List
export const onRaw349 = (): void => {
  setChannelSettingsIsExceptionListLoading(false);
};

// :server 367 mynick #channel mask!*@* setter 1234567890
export const onRaw367 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const mask = ctx.line.shift();
  const setBy = ctx.line.shift() ?? '';
  const setTime = Number(ctx.line.shift() ?? '0');

  if (channel === undefined || mask === undefined) {
    return;
  }

  const settingsChannel = useChannelSettingsStore.getState().channelName;
  if (settingsChannel !== channel) {
    return;
  }

  addToChannelSettingsBanList({ mask, setBy, setTime });
};

// :server 368 mynick #channel :End of Channel Ban List
export const onRaw368 = (): void => {
  setChannelSettingsIsBanListLoading(false);
};

// :server 221 yournick +iwx
export const onRaw221 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const modes = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.221', { modes, defaultValue: `Your user modes: ${modes}` }),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 329 mynick #channel timestamp
export const onRaw329 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const timestamp = Number(ctx.line.shift() ?? '0');

  if (channel && timestamp > 0) {
    const createdDate = format(new Date(timestamp * 1000), 'd MMM yyyy HH:mm', { locale: getDateFnsLocale() });
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.329', { channel, created: createdDate, defaultValue: `Channel created: ${createdDate}` }),
      target: channel,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 472 mynick char :is unknown mode char to me
export const onRaw472 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const modeChar = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${modeChar}: ${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 478 mynick #channel mask :Channel ban list is full
export const onRaw478 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const mask = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${channel} ${mask}: ${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 482 mynick #channel :You're not channel operator
export const onRaw482 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === "You're not channel operator") {
    message = i18next.t('kernel.482.not-channel-operator', { defaultValue: message });
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${channel}: ${message}`,
    target: channel ?? STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 501 mynick :Unknown MODE flag
export const onRaw501 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 502 mynick :Cannot change mode for other users
export const onRaw502 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

export const handlers: IrcHandlers = {
  MODE: onMode,
  [RPL_CHANNELMODEIS]: onRaw324,
  [RPL_INVITELIST]: onRaw346,
  [RPL_ENDOFINVITELIST]: onRaw347,
  [RPL_EXCEPTLIST]: onRaw348,
  [RPL_ENDOFEXCEPTLIST]: onRaw349,
  [RPL_BANLIST]: onRaw367,
  [RPL_ENDOFBANLIST]: onRaw368,
  [RPL_CREATIONTIME]: onRaw329,
  [ERR_UNKNOWNMODE]: onRaw472,
  [ERR_BANLISTFULL]: onRaw478,
  [ERR_CHANOPRIVSNEEDED]: onRaw482,
  [ERR_UMODEUNKNOWNFLAG]: onRaw501,
  [ERR_USERSDONTMATCH]: onRaw502,
  [RPL_UMODEIS]: onRaw221,
};
