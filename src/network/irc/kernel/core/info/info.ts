import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_INFO = '371';
const RPL_ENDOFINFO = '374';

// :server 371 mynick :info line
export const onRaw371 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 374 mynick :End of INFO list
export const onRaw374 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_INFO]: onRaw371,
  [RPL_ENDOFINFO]: onRaw374,
};
