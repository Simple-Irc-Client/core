import i18next from '@/app/i18n';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_ISON = '303';

// Reply to /ison: the subset of the asked nicks that are online
// :server 303 mynick :alice bob
export const onRaw303 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nicks = ctx.trailing().trim();

  showReply(ctx, {
    message: nicks === '' ? i18next.t('kernel.303.none') : i18next.t('kernel.303', { nicks }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_ISON]: onRaw303,
};
