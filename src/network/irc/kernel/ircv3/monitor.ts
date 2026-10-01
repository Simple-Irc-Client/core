import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { resumePendingEncryption } from '@features/e2ee/session';
import { addMonitoredNick, setMultipleMonitorOffline, setMultipleMonitorOnline } from '@features/monitor/store/monitor';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_MONONLINE = '730';
const RPL_MONOFFLINE = '731';
const RPL_MONLIST = '732';
const RPL_ENDOFMONLIST = '733';
const ERR_MONLISTFULL = '734';

// MONITOR responses
// :server 730 <nick> :nick1!user@host,nick2!user@host
export const onRaw730 = (ctx: IrcContext): void => {
  const userList = ctx.line.slice(1).join(' ').replace(/^:/, '');
  if (!userList) { return; }

  const users = userList.split(',');
  const nicks: string[] = [];
  const userStrings: string[] = [];

  for (const user of users) {
    const nick = user.split('!')[0];
    if (nick) {
      nicks.push(nick);
      userStrings.push(user);
    }
  }

  if (nicks.length > 0) {
    setMultipleMonitorOnline(nicks, userStrings);
    // Re-offer E2EE to peers we were encrypted with before a reconnect
    for (const nick of nicks) {
      void resumePendingEncryption(nick);
    }
  }
};

// :server 731 <nick> :nick1,nick2,nick3
export const onRaw731 = (ctx: IrcContext): void => {
  const nickList = ctx.line.slice(1).join(' ').replace(/^:/, '');
  if (!nickList) { return; }

  const nicks = nickList.split(',').filter((n) => n.length > 0);

  if (nicks.length > 0) {
    setMultipleMonitorOffline(nicks);
  }
};

// :server 732 <nick> :nick1,nick2,nick3
export const onRaw732 = (ctx: IrcContext): void => {
  const nickList = ctx.line.slice(1).join(' ').replace(/^:/, '');
  if (!nickList) { return; }

  const nicks = nickList.split(',').filter((n) => n.length > 0);

  for (const nick of nicks) {
    addMonitoredNick(nick);
  }
};

// :server 733 <nick> :End of MONITOR list
export const onRaw733 = (): void => {
  // Nothing to do
};

// :server 734 <nick> <limit> <nicks> :Monitor list is full
export const onRaw734 = (ctx: IrcContext): void => {
  const limit = ctx.line[1];
  const nicks = ctx.line[2];

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.monitor.listFull', { limit, nicks }),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

export const handlers: IrcHandlers = {
  [RPL_MONONLINE]: onRaw730,
  [RPL_MONOFFLINE]: onRaw731,
  [RPL_MONLIST]: onRaw732,
  [RPL_ENDOFMONLIST]: onRaw733,
  [ERR_MONLISTFULL]: onRaw734,
};
