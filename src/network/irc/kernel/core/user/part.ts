import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { existChannel, setAddMessage, setRemoveChannel } from '@features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, getUserModes, isSameName, setCurrentChannelName } from '@features/settings/store/settings';
import { getUser, getUserChannels, setRemoveUser } from '@features/users/store/users';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const ERR_NOTONCHANNEL = '442';

// @account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał
// :mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP PART :#chat
export const onPart = (ctx: IrcContext): void => {
  let channel = ctx.line.shift();
  const reason = ctx.trailing();

  if (channel === undefined) {
    ctx.logParseError(onPart, 'channel');
    return;
  }

  if (channel.startsWith(':')) {
    channel = channel.substring(1);
  }

  const { nick } = parseNick(ctx.sender, getUserModes());

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.part', { nick, reason: reason.length !== 0 ? ` (${reason})` : '' }),
    nick: getUser(nick) ?? nick,
    target: channel,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.part,
    color: MessageColor.part,
  });

  setRemoveUser(nick, channel);

  if (isSameName(nick, getCurrentNick())) {
    setRemoveChannel(channel);

    if (isSameName(getCurrentChannelName(), channel)) {
      setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
    }
  }
};

// :chmurka.pirc.pl 442 sic-test #kanjpa :You're not on that channel
export const onRaw442 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw442, 'channel');
    return;
  }

  let message = ctx.line.join(' ');
  if (message.startsWith(':')) {
    message = message.substring(1);
  }

  if (message === "You're not on that channel") {
    message = i18next.t('kernel.442.youre-not-on-that-channel');
  }

  showReply(ctx, {
    message: `${channel} :${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });

  // A leftover window (stale or already parted) would otherwise never close: its PART gets 442
  const isTrackedMember = getUserChannels(getCurrentNick()).some((name) => isSameName(name, channel));
  if (existChannel(channel) && !isTrackedMember) {
    setRemoveChannel(channel);

    if (isSameName(getCurrentChannelName(), channel)) {
      setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
    }
  }
};

export const handlers: IrcHandlers = {
  PART: onPart,
  [ERR_NOTONCHANNEL]: onRaw442,
};
