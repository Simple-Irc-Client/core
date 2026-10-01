import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_VERSION = '351';

// :server 351 mynick version.debuglevel server :comments
export const onRaw351 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const version = ctx.line.shift();
  const server = ctx.line.shift();
  const comments = ctx.trailing();

  addReply(ctx, {
    message: `${server} ${version} ${comments}`,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_VERSION]: onRaw351,
};
