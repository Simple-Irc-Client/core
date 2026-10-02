import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { setAddMessage, setRemoveChannel } from '@features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, getUserModes, isSameName, setCurrentChannelName } from '@features/settings/store/settings';
import { getUser, setRemoveUser } from '@features/users/store/users';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const ERR_USERNOTINCHANNEL = '441';

// @account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__
export const onKick = (ctx: IrcContext): void => {
  const currentNick = getCurrentNick();

  const channel = ctx.line.shift();
  const kicked = ctx.line.shift();
  const reason = ctx.trailing();

  if (kicked === undefined) {
    ctx.logParseError(onKick, 'kicked');
    return;
  }

  if (channel === undefined) {
    ctx.logParseError(onKick, 'channel');
    return;
  }

  const { nick } = parseNick(ctx.sender, getUserModes());

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t(`kernel.kick${isSameName(kicked, currentNick) ? '-you' : ''}`, { kicked, kickedBy: nick, channel, reason: reason.length !== 0 ? `(${reason})` : '' }),
    nick: getUser(nick) ?? nick,
    target: isSameName(kicked, currentNick) ? STATUS_CHANNEL : channel,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.kick,
    color: MessageColor.kick,
  });

  setRemoveUser(kicked, channel);

  if (isSameName(kicked, currentNick)) {
    setRemoveChannel(channel);

    if (isSameName(getCurrentChannelName(), channel)) {
      setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
    }
  }
};

// :server 441 mynick nick #channel :They aren't on that channel
export const onRaw441 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === "They aren't on that channel") {
    message = i18next.t('kernel.441.not-on-channel', { defaultValue: message });
  }

  showReply(ctx, {
    message: `${nick} ${channel}: ${message}`,
    target: currentChannelName,
    category: MessageCategory.error,
  });
};

export const handlers: IrcHandlers = {
  KICK: onKick,
  [ERR_USERNOTINCHANNEL]: onRaw441,
};
