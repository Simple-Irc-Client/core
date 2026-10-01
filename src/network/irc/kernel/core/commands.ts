import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { getCurrentChannelName } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const ERR_NOSUCHSERVER = '402';
const ERR_INPUTTOOLONG = '417';
const ERR_UNKNOWNCOMMAND = '421';
const ERR_NEEDMOREPARAMS = '461';

// :server 402 mynick server :No such server
export const onRaw402 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const server = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${server}: ${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 417 mynick :Input line was too long
export const onRaw417 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 421 mynick COMMAND :Unknown command
export const onRaw421 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const command = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Unknown command') {
    message = i18next.t('kernel.421.unknown-command', { defaultValue: message });
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${command}: ${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 461 mynick COMMAND :Not enough parameters
export const onRaw461 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();
  ctx.line.shift(); // my nick
  const command = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Not enough parameters') {
    message = i18next.t('kernel.461.not-enough-parameters', { defaultValue: message });
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${command}: ${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

export const handlers: IrcHandlers = {
  [ERR_NOSUCHSERVER]: onRaw402,
  [ERR_INPUTTOOLONG]: onRaw417,
  [ERR_UNKNOWNCOMMAND]: onRaw421,
  [ERR_NEEDMOREPARAMS]: onRaw461,
};
