import i18next from '@/app/i18n';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

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

  showReply(ctx, {
    message: i18next.t('kernel.728', { channel, mask, setBy, defaultValue: `${channel} quiet: ${mask} (set by ${setBy})` }),
    target: channel,
    category: MessageCategory.info,
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
