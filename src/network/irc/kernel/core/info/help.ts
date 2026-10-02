import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const ERR_HELPNOTFOUND = '524';
const RPL_HELPSTART = '704';
const RPL_HELPTXT = '705';
const RPL_ENDOFHELP = '706';

// :server 524 mynick topic :Help not found
export const onRaw524 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const topic = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `${topic}: ${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

// :server 704 mynick topic :help text start
export const onRaw704 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const topic = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `[${topic}] ${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 705 mynick topic :help text line
export const onRaw705 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  ctx.line.shift(); // topic
  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 706 mynick topic :End of /HELP
export const onRaw706 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const topic = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `[${topic}] ${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [ERR_HELPNOTFOUND]: onRaw524,
  [RPL_HELPSTART]: onRaw704,
  [RPL_HELPTXT]: onRaw705,
  [RPL_ENDOFHELP]: onRaw706,
};
