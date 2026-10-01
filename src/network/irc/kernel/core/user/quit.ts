import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { endSession } from '@features/e2ee/session';
import { setMultipleMonitorOffline } from '@features/monitor/store/monitor';
import { getUserModes } from '@features/settings/store/settings';
import { getUser, setQuitUser } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// @msgid=aGJTRBjAMOMRB6Ky2ucXbV-Gved4HyF6QNSHYfzOX1jOA;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving
export const onQuit = (ctx: IrcContext): void => {
  const reason = ctx.trailing();

  const { nick } = parseNick(ctx.sender, getUserModes());

  const message = {
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.quit', { nick, reason: reason.length !== 0 ? ` (${reason})` : '' }),
    nick: getUser(nick) ?? nick,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.quit,
    color: MessageColor.quit,
  };

  // Peer is gone: drop the session without a RESET (nobody to tell)
  endSession(nick, false);

  // QUIT is proof enough; don't wait for MONITOR/WATCH
  setMultipleMonitorOffline([nick]);

  setQuitUser(nick, message);
};

export const handlers: IrcHandlers = {
  QUIT: onQuit,
};
