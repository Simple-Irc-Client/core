import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_TIME = '391';

// :server 391 mynick server :timestamp
export const onRaw391 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const server = ctx.line.shift();
  const timeString = ctx.trailing();

  addReply(ctx, {
    message: i18next.t('kernel.391', { server, time: timeString, defaultValue: `${server}: ${timeString}` }),
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_TIME]: onRaw391,
};
