import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_ADMINME = '256';
const RPL_ADMINLOC1 = '257';
const RPL_ADMINLOC2 = '258';
const RPL_ADMINEMAIL = '259';

// :server 256 nick :Administrative info about server
export const onRaw256 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 257 nick :Location line 1
export const onRaw257 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 258 nick :Location line 2
export const onRaw258 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :server 259 nick :Admin email
export const onRaw259 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  addReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_ADMINME]: onRaw256,
  [RPL_ADMINLOC1]: onRaw257,
  [RPL_ADMINLOC2]: onRaw258,
  [RPL_ADMINEMAIL]: onRaw259,
};
