import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_QUIETLIST = '728';
const RPL_ENDOFQUIETLIST = '729';

// :server 728 mynick #channel q mask setter timestamp
export const onRaw728 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  ctx.line.shift(); // mode - usually 'q' for quiet
  const mask = ctx.line.shift();
  const setBy = ctx.line.shift() ?? '';

  if (channel === undefined || mask === undefined) {
    return;
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.728', { channel, mask, setBy, defaultValue: `${channel} quiet: ${mask} (set by ${setBy})` }),
    target: channel,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 729 mynick #channel q :End of Channel Quiet List
export const onRaw729 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  ctx.line.shift(); // channel
  ctx.line.shift(); // mode
  // End of quiet list - nothing specific to do
};

export const handlers: IrcHandlers = {
  [RPL_QUIETLIST]: onRaw728,
  [RPL_ENDOFQUIETLIST]: onRaw729,
};
