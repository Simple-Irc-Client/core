import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_REHASHING = '382';

// :server 382 mynick config.conf :Rehashing
export const onRaw382 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const configFile = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${configFile} ${message}`,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_REHASHING]: onRaw382,
};
