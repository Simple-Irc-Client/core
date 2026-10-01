import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_LINKS = '364';
const RPL_ENDOFLINKS = '365';

// :server 364 mynick mask server :hopcount info
export const onRaw364 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const mask = ctx.line.shift();
  const server = ctx.line.shift();
  const info = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${mask} ${server} ${info}`,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 365 mynick mask :End of /LINKS list
export const onRaw365 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const mask = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${mask} ${message}`,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_LINKS]: onRaw364,
  [RPL_ENDOFLINKS]: onRaw365,
};
