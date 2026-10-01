import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { handleConnected } from '@/network/irc/kernel/connection';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { ircSendList } from '@/network/irc/network';
import { setAddMessage, setAddMessageToAllChannels } from '@features/channels/store/channels';
import { getCurrentNick, getIsWizardCompleted, isSameName, setNick, setWizardProgress } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_WELCOME = '001';
const RPL_YOURHOST = '002';
const RPL_CREATED = '003';
const RPL_MYINFO = '004';
const RPL_BOUNCE = '010';
const RPL_PROCESSING = '020';
const RPL_YOURID = '042';
const RPL_HOSTHIDDEN = '396';
const ERR_NOTREGISTERED = '451';
const ERR_ALREADYREGISTRED = '462';
const ERR_PASSWDMISMATCH = '464';
const ERR_YOUREBANNEDCREEP = '465';

// :netsplit.pirc.pl 001 SIC-test :Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1
export const onRaw001 = (ctx: IrcContext): void => {
  // RPL_WELCOME marks registration; transports never inspect it
  handleConnected();

  const myNick = ctx.line.shift();

  if (myNick && !isSameName(myNick, getCurrentNick())) {
    setNick(myNick);
  }

  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });

  ircSendList();
};

// :netsplit.pirc.pl 002 SIC-test :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3
export const onRaw002 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :netsplit.pirc.pl 003 SIC-test :This server was created Sun May 8 2022 at 13:49:18 UTC
export const onRaw003 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :netsplit.pirc.pl 004 SIC-test netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ
export const onRaw004 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: ctx.line.join(' '),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :chmurka.pirc.pl 396 sic-test A.A.A.IP :is now your displayed host
export const onRaw396 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.line.join(' ');

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 010 * <hostname> <port> :Server redirect
export const onRaw010 = (ctx: IrcContext): void => {
  ctx.line.shift(); // asterisk
  const hostname = ctx.line.shift();
  const port = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.010', { hostname, port, message, defaultValue: `Server redirect: ${hostname}:${port} ${message}` }),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 020 * :Please wait while we process your connection.
export const onRaw020 = (ctx: IrcContext): void => {
  ctx.line.shift(); // asterisk
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 042 nick uniqueID :your unique ID
export const onRaw042 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const uniqueId = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${uniqueId} ${message}`,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :server 451 * :You have not registered
export const onRaw451 = (ctx: IrcContext): void => {
  ctx.line.shift(); // asterisk
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 462 mynick :You may not reregister
export const onRaw462 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 464 * :Password incorrect
export const onRaw464 = (ctx: IrcContext): void => {
  ctx.line.shift(); // asterisk
  let message = ctx.trailing();

  if (message === 'Password incorrect') {
    message = i18next.t('kernel.464.password-incorrect', { defaultValue: message });
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });

  if (!getIsWizardCompleted()) {
    setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
  }
};

// :server 465 mynick :You are banned from this server
export const onRaw465 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });

  if (!getIsWizardCompleted()) {
    setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
  }
};

export const handlers: IrcHandlers = {
  [RPL_WELCOME]: onRaw001,
  [RPL_YOURHOST]: onRaw002,
  [RPL_CREATED]: onRaw003,
  [RPL_MYINFO]: onRaw004,
  [RPL_HOSTHIDDEN]: onRaw396,
  [RPL_BOUNCE]: onRaw010,
  [RPL_PROCESSING]: onRaw020,
  [RPL_YOURID]: onRaw042,
  [ERR_NOTREGISTERED]: onRaw451,
  [ERR_ALREADYREGISTRED]: onRaw462,
  [ERR_PASSWDMISMATCH]: onRaw464,
  [ERR_YOUREBANNEDCREEP]: onRaw465,
};
