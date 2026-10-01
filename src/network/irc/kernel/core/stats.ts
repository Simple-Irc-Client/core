import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_STATSCOMMANDS = '212';
const RPL_ENDOFSTATS = '219';
const RPL_STATSUPTIME = '242';

// :server 212 nick COMMAND count bytes remote_count
export const onRaw212 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.line.join(' ');

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 219 nick type :End of STATS report
export const onRaw219 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const statsType = ctx.line.shift();
  const message = ctx.trailing();

  addReply(ctx, {
    message: `${statsType} ${message}`,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 242 nick :Server Up 14 days, 2:34:56
export const onRaw242 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_STATSCOMMANDS]: onRaw212,
  [RPL_ENDOFSTATS]: onRaw219,
  [RPL_STATSUPTIME]: onRaw242,
};
