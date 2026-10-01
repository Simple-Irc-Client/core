import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { getCurrentChannelName } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// Error replies outside the 400–599 range: STARTTLS, mode params, oper privs, MLOCK, metadata, knock, Unreal
const OUT_OF_RANGE_ERROR_NUMERICS = new Set(['691', '696', '712', '713', '714', '723', '742', '764', '765', '767', '768', '769', '972', '974']);

const isErrorNumeric = (numeric: string): boolean => {
  const value = Number.parseInt(numeric, 10);
  return (value >= 400 && value <= 599) || OUT_OF_RANGE_ERROR_NUMERICS.has(numeric);
};

// Shown rather than dropped; errors go to the window the user is looking at
// :server 438 mynick newnick :Nick change too fast. Please wait 30 seconds.
export const onUnhandledNumeric = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const trailingIndex = ctx.line.findIndex((token) => token.startsWith(':'));
  const params = trailingIndex === -1 ? ctx.line : ctx.line.slice(0, trailingIndex);
  const text = trailingIndex === -1 ? '' : ctx.stripColon(ctx.line.slice(trailingIndex).join(' '));
  const message = [params.join(' '), text].filter((part) => part !== '').join(': ');

  if (message === '') {
    return;
  }

  const isError = isErrorNumeric(ctx.command);

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: isError ? getCurrentChannelName() : STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: isError ? MessageCategory.error : MessageCategory.info,
    color: isError ? MessageColor.error : MessageColor.info,
  });
};
