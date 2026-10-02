import i18next from '@/app/i18n';
import { defaultMaxPermission } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { ircRequestChatHistory, ircRequestMetadataList, ircSendRawMessage } from '@/network/irc/network';
import { existChannel, getChannel, setAddMessage, setRenameChannel } from '@features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, getUserModes, isSameName, isSupportedOption, setCurrentChannelName } from '@features/settings/store/settings';
import { getUser, setAddUser } from '@features/users/store/users';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_CHANNEL_URL = '328';
const ERR_NOSUCHCHANNEL = '403';
const ERR_TOOMANYCHANNELS = '405';
const ERR_FORBIDDENCHANNEL = '448';
const ERR_LINKCHANNEL = '470';
const ERR_CHANNELISFULL = '471';
const ERR_INVITEONLYCHAN = '473';
const ERR_BANNEDFROMCHAN = '474';
const ERR_BADCHANNELKEY = '475';
const ERR_BADCHANMASK = '476';
const ERR_NEEDREGGEDNICK = '477';

// @msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #sic * :Simple Irc Client user
// :mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP JOIN :#chat
export const onJoin = (ctx: IrcContext): void => {
  let channel = ctx.line.shift();
  const { nick, ident, hostname } = parseNick(ctx.sender, getUserModes());

  if (channel === undefined) {
    ctx.logParseError(onJoin, 'channel');
    return;
  }

  if (channel.startsWith(':')) {
    channel = channel.substring(1);
  }

  // Before setAddMessage auto-creates it: tells a fresh join from a reconnect rejoin
  const channelExisted = existChannel(channel);

  // The server's casing is authoritative
  const openedAs = getChannel(channel)?.name;
  if (openedAs !== undefined && openedAs !== channel) {
    setRenameChannel(openedAs, channel);
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.join', { nick }),
    nick: getUser(nick) ?? nick,
    target: channel,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.join,
    color: MessageColor.join,
  });

  setAddUser({
    nick,
    ident,
    hostname,
    flags: [],
    channels: [{ name: channel, flags: [], maxPermission: defaultMaxPermission }],
  });

  if (isSameName(nick, getCurrentNick())) {
    if (!channelExisted) {
      setCurrentChannelName(channel, ChannelCategory.channel);
    }
    ircSendRawMessage(`MODE ${channel}`);
    if (isSupportedOption('WHOX')) {
      ircSendRawMessage(`WHO ${channel} %chtsunfra,152`);
    }
    if (isCapabilityEnabled('draft/chathistory')) {
      ircRequestChatHistory(channel, 'LATEST', undefined, 50);
    }
    if (isCapabilityEnabled('draft/metadata-2') || isCapabilityEnabled('draft/metadata') || isCapabilityEnabled('draft/metadata-notify-2')) {
      ircRequestMetadataList(channel);
    }
  }
};

// :chommik.pirc.pl 473 sic-test #sic :Cannot join channel (+i)
export const onRaw473 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();

  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw473, 'channel');
    return;
  }

  let message = ctx.line.join(' ');
  if (message.startsWith(':')) {
    message = message.substring(1);
  }

  if (message === 'Cannot join channel (+i)') {
    message = i18next.t('kernel.473.cannot-join-channel-i');
  }

  addReply(ctx, {
    message: `${channel} :${message}`,
    target: currentChannelName,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 474 mero-test #bog :Cannot join channel (+b)
export const onRaw474 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();

  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw474, 'channel');
    return;
  }

  let message = ctx.line.join(' ');
  if (message.startsWith(':')) {
    message = message.substring(1);
  }

  if (message === 'Cannot join channel (+b)') {
    message = i18next.t('kernel.474.cannot-join-channel-b');
  }

  addReply(ctx, {
    message: `${channel} :${message}`,
    target: currentChannelName,
    category: MessageCategory.info,
  });
};

// :insomnia.pirc.pl 477 test #knajpa :You need a registered nick to join that channel.
export const onRaw477 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();

  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw477, 'channel');
    return;
  }

  let message = ctx.line.join(' ');
  if (message.startsWith(':')) {
    message = message.substring(1);
  }

  if (message === 'You need a registered nick to join that channel.') {
    message = i18next.t('kernel.477.you-need-a-registered-nick-to-join-that-channel');
  }

  addReply(ctx, {
    message: `${channel} :${message}`,
    target: currentChannelName,
    category: MessageCategory.info,
  });
};

// :server 328 mynick #channel :https://channel-url.com
export const onRaw328 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const url = ctx.trailing();

  if (channel) {
    addReply(ctx, {
      message: i18next.t('kernel.328', { channel, url, defaultValue: `Channel URL: ${url}` }),
      target: channel,
      category: MessageCategory.info,
    });
  }
};

// :server 403 mynick #channel :No such channel
export const onRaw403 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'No such channel') {
    message = i18next.t('kernel.403.no-such-channel', { defaultValue: message });
  }

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 405 mynick #channel :You have joined too many channels
export const onRaw405 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'You have joined too many channels') {
    message = i18next.t('kernel.405.too-many-channels', { defaultValue: message });
  }

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 448 mynick channel :Cannot join channel: invalid name
export const onRaw448 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const message = ctx.trailing();

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 471 mynick #channel :Cannot join channel (+l)
export const onRaw471 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Cannot join channel (+l)') {
    message = i18next.t('kernel.471.channel-full', { defaultValue: message });
  }

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 475 mynick #channel :Cannot join channel (+k)
export const onRaw475 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Cannot join channel (+k)') {
    message = i18next.t('kernel.475.bad-channel-key', { defaultValue: message });
  }

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// :server 476 mynick #channel :Bad Channel Mask
export const onRaw476 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const message = ctx.trailing();

  addReply(ctx, {
    message: `${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

// The JOIN for the target channel follows
// :server 470 mynick #from #to :Forwarding to another channel
export const onRaw470 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const from = ctx.line.shift();
  const to = ctx.line.shift();
  const message = ctx.trailing();

  addReply(ctx, {
    message: `${from} → ${to}: ${message}`,
    target: getCurrentChannelName(),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  JOIN: onJoin,
  [ERR_INVITEONLYCHAN]: onRaw473,
  [ERR_BANNEDFROMCHAN]: onRaw474,
  [ERR_NEEDREGGEDNICK]: onRaw477,
  [RPL_CHANNEL_URL]: onRaw328,
  [ERR_NOSUCHCHANNEL]: onRaw403,
  [ERR_TOOMANYCHANNELS]: onRaw405,
  [ERR_FORBIDDENCHANNEL]: onRaw448,
  [ERR_LINKCHANNEL]: onRaw470,
  [ERR_CHANNELISFULL]: onRaw471,
  [ERR_BADCHANNELKEY]: onRaw475,
  [ERR_BADCHANMASK]: onRaw476,
};
