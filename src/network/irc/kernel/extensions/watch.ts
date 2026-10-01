import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { resumePendingEncryption } from '@features/e2ee/session';
import { setMultipleMonitorOffline, setMultipleMonitorOnline } from '@features/monitor/store/monitor';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_REAWAY = '597';
const RPL_GONEAWAY = '598';
const RPL_NOTAWAY = '599';
const RPL_LOGON = '600';
const RPL_LOGOFF = '601';
const RPL_WATCHOFF = '602';
const RPL_WATCHSTAT = '603';
const RPL_NOWON = '604';
const RPL_NOWOFF = '605';
const RPL_WATCHLIST = '606';
const RPL_ENDOFWATCHLIST = '607';
const RPL_CLEARWATCH = '608';
const RPL_NOWISAWAY = '609';

// WATCH responses (597-609)
// :server 597 yournick nick ident host timestamp :is now away
export const onRaw597 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User is now away again (after returning)
  if (nick) {
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchaway', { nick, defaultValue: `${nick} is now away` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 598 yournick nick ident host timestamp :went away
export const onRaw598 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User went away
  if (nick) {
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchaway', { nick, defaultValue: `${nick} is now away` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 599 yournick nick ident host timestamp :is no longer away
export const onRaw599 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User is back from away
  if (nick) {
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchback', { nick, defaultValue: `${nick} is no longer away` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 600 yournick nick ident host timestamp :logged on
export const onRaw600 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User came online - use monitor store for consistency
  if (nick) {
    setMultipleMonitorOnline([nick]);
    void resumePendingEncryption(nick);
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchonline', { nick, defaultValue: `${nick} is now online` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 601 yournick nick ident host timestamp :logged off
export const onRaw601 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User went offline
  if (nick) {
    setMultipleMonitorOffline([nick]);
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchoffline', { nick, defaultValue: `${nick} is now offline` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 602 yournick nick ident host timestamp :stopped watching
export const onRaw602 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // Stopped watching nick
  if (nick) {
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchremoved', { nick, defaultValue: `Stopped watching ${nick}` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 603 yournick :You have X and are on Y WATCH entries
export const onRaw603 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();
  // Watch statistics
  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 604 yournick nick ident host timestamp :is online
export const onRaw604 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User is currently online (when adding to watch list)
  if (nick) {
    setMultipleMonitorOnline([nick]);
    void resumePendingEncryption(nick);
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchonline', { nick, defaultValue: `${nick} is now online` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 605 yournick nick * * 0 :is offline
export const onRaw605 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User is currently offline (when adding to watch list)
  if (nick) {
    setMultipleMonitorOffline([nick]);
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchoffline', { nick, defaultValue: `${nick} is now offline` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

// :server 606 yournick :nick1 nick2 nick3
export const onRaw606 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nicks = ctx.trailing();
  // Watch list entries
  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.watchlist', { nicks, defaultValue: `Watch list: ${nicks}` }),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 607 yournick :End of WATCH list
export const onRaw607 = (): void => {
  // End of watch list - nothing specific to do
};

// :server 608 yournick :Watch list cleared
export const onRaw608 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.watchcleared', { defaultValue: 'Watch list cleared' }),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 609 yournick nick ident host timestamp :is away
export const onRaw609 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  // User is currently away (when adding to watch list)
  if (nick) {
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchaway', { nick, defaultValue: `${nick} is now away` }),
      target: STATUS_CHANNEL,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

export const handlers: IrcHandlers = {
  [RPL_REAWAY]: onRaw597,
  [RPL_GONEAWAY]: onRaw598,
  [RPL_NOTAWAY]: onRaw599,
  [RPL_LOGON]: onRaw600,
  [RPL_LOGOFF]: onRaw601,
  [RPL_WATCHOFF]: onRaw602,
  [RPL_WATCHSTAT]: onRaw603,
  [RPL_NOWON]: onRaw604,
  [RPL_NOWOFF]: onRaw605,
  [RPL_WATCHLIST]: onRaw606,
  [RPL_ENDOFWATCHLIST]: onRaw607,
  [RPL_CLEARWATCH]: onRaw608,
  [RPL_NOWISAWAY]: onRaw609,
};
