import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_REHASHING = '382';

// :server 382 mynick config.conf :Rehashing
export const onRaw382 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const configFile = ctx.line.shift();
  const message = ctx.trailing();

  addReply(ctx, {
    message: `${configFile} ${message}`,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_REHASHING]: onRaw382,
};
