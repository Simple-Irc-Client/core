import i18next from '@/app/i18n';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { getCurrentChannelName } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';

const RPL_ISON = '303';

// Reply to /ison: the subset of the asked nicks that are online
// :server 303 mynick :alice bob
export const onRaw303 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nicks = ctx.trailing().trim();

  addReply(ctx, {
    message: nicks === '' ? i18next.t('kernel.303.none') : i18next.t('kernel.303', { nicks }),
    target: getCurrentChannelName(),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_ISON]: onRaw303,
};
