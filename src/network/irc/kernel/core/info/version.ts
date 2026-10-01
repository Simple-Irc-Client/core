import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_VERSION = '351';

// :server 351 mynick version.debuglevel server :comments
export const onRaw351 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const version = ctx.line.shift();
  const server = ctx.line.shift();
  const comments = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${server} ${version} ${comments}`,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_VERSION]: onRaw351,
};
