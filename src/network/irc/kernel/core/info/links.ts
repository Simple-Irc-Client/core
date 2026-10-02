import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_LINKS = '364';
const RPL_ENDOFLINKS = '365';

// :server 364 mynick mask server :hopcount info
export const onRaw364 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const mask = ctx.line.shift();
  const server = ctx.line.shift();
  const info = ctx.trailing();

  showReply(ctx, {
    message: `${mask} ${server} ${info}`,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 365 mynick mask :End of /LINKS list
export const onRaw365 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const mask = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `${mask} ${message}`,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_LINKS]: onRaw364,
  [RPL_ENDOFLINKS]: onRaw365,
};
