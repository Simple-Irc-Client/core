import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessageToAllChannels } from '@features/channels/store/channels';
import { getUserModes } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// :server KILL scc_test :Killed (Nickname collision)
export const onKill = (ctx: IrcContext): void => {
  ctx.line.shift(); // me

  const { nick } = parseNick(ctx.sender, getUserModes());

  const reason = ctx.trailing();

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.kill', { nick, reason: reason.length !== 0 ? `(${reason})` : '' }),
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

export const handlers: IrcHandlers = {
  KILL: onKill,
};
