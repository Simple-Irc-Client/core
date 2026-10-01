import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { getCurrentChannelName, getUserModes } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_INVITING = '341';
const ERR_USERONCHANNEL = '443';

// @msgid=WglKE4an4Y6MGcC9tVM7jV;time=2023-03-23T00:58:29.305Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP INVITE sic-test :#sic
export const onInvite = (ctx: IrcContext): void => {
  ctx.line.shift(); // invited

  const rawChannel = ctx.line.shift();
  const channel = rawChannel !== undefined ? ctx.stripColon(rawChannel) : undefined;

  if (channel === undefined) {
    ctx.logParseError(onInvite, 'channel');
    return;
  }

  const { nick } = parseNick(ctx.sender, getUserModes());

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.invite', { nick, channel }),
    target: getCurrentChannelName(),
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 341 mynick invitedUser #channel
export const onRaw341 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const invitedUser = ctx.line.shift();
  const channel = ctx.line.shift();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.341', { user: invitedUser, channel, defaultValue: `Inviting ${invitedUser} to ${channel}` }),
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 443 mynick nick #channel :is already on channel
export const onRaw443 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'is already on channel') {
    message = i18next.t('kernel.443.already-on-channel', { defaultValue: message });
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${nick} ${channel}: ${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

export const handlers: IrcHandlers = {
  INVITE: onInvite,
  [RPL_INVITING]: onRaw341,
  [ERR_USERONCHANNEL]: onRaw443,
};
