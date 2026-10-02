import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { setAddMessageToAllChannels } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_YOUREOPER = '381';
const ERR_NOPRIVILEGES = '481';

// :server 381 mynick :You are now an IRC operator
export const onRaw381 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  let message = ctx.trailing();

  if (message === 'You are now an IRC operator') {
    message = i18next.t('kernel.381.you-are-now-an-irc-operator', { defaultValue: message });
  }

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 481 mynick :Permission Denied- You're not an IRC operator
export const onRaw481 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

export const handlers: IrcHandlers = {
  [RPL_YOUREOPER]: onRaw381,
  [ERR_NOPRIVILEGES]: onRaw481,
};
