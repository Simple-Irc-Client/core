import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_TIME = '391';

// :server 391 mynick server :timestamp
export const onRaw391 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const server = ctx.line.shift();
  const timeString = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.391', { server, time: timeString, defaultValue: `${server}: ${timeString}` }),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_TIME]: onRaw391,
};
