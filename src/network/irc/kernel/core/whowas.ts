import i18next from '@/app/i18n';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_WHOWASUSER = '314';
const RPL_ENDOFWHOWAS = '369';
const ERR_WASNOSUCHNICK = '406';

// :server 314 nick user host * :realname (WHOWAS reply)
export const onRaw314 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const host = ctx.line.join(' ');

  showReply(ctx, {
    message: i18next.t('kernel.314', { user, host, defaultValue: `${user} was ${host}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 369 mynick nick :End of WHOWAS
export const onRaw369 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `* ${nick} ${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 406 mynick nick :There was no such nickname
export const onRaw406 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `${nick}: ${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

export const handlers: IrcHandlers = {
  [RPL_WHOWASUSER]: onRaw314,
  [RPL_ENDOFWHOWAS]: onRaw369,
  [ERR_WASNOSUCHNICK]: onRaw406,
};
