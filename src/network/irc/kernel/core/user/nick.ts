import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage, setAddMessageToAllChannels } from '@features/channels/store/channels';
import { handlePresenceNickChange } from '@features/dmPresence/dmPresence';
import { handlePeerRename } from '@features/e2ee/session';
import { getCurrentChannelName, getCurrentNick, getIsWizardCompleted, getNickLenLimit, getUserModes, isSameName, setNick, setWizardProgress } from '@features/settings/store/settings';
import { getUserChannels, setRenameUser } from '@features/users/store/users';
import { isValidNick } from '@shared/lib/utils';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const ERR_NONICKNAMEGIVEN = '431';
const ERR_ERRONEUSNICKNAME = '432';
const ERR_NICKNAMEINUSE = '433';
const ERR_NICKCOLLISION = '436';
const ERR_NONICKCHANGE = '447';

// @msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707
export const onNick = (ctx: IrcContext): void => {
  const { nick: oldNick } = parseNick(ctx.sender, getUserModes());
  const rawNick = ctx.line.shift();

  if (rawNick === undefined) {
    ctx.logParseError(onNick, 'newNick');
    return;
  }

  const newNick = ctx.stripColon(rawNick);

  if (!isValidNick(newNick, getNickLenLimit())) {
    return;
  }

  const channels = getUserChannels(oldNick);
  setRenameUser(oldNick, newNick);

  // E2EE doesn't follow a nick change: a NICK is no proof it's the same person
  handlePeerRename(oldNick, newNick);

  // Presence has no trust question: MONITOR/WATCH is keyed by nick string anyway
  handlePresenceNickChange(oldNick, newNick);

  for (const channel of channels) {
    setAddMessage({
      id: ctx.tags.msgid ?? uuidv4(),
      message: i18next.t('kernel.nick', { from: oldNick, to: newNick }),
      target: channel,
      time: ctx.tags.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }

  if (isSameName(oldNick, getCurrentNick())) {
    setNick(newNick);
  }
};

// :insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user
// :irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname
export const onRaw432 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();

  ctx.line.shift(); // asterisk
  const nick = ctx.line.shift();

  if (nick === undefined) {
    ctx.logParseError(onRaw432, 'nick');
    return;
  }

  let message = ctx.line.join(' ');
  if (message.startsWith(':')) {
    message = message.substring(1);
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${nick} :${message}`,
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });

  if (!getIsWizardCompleted()) {
    setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
  }
};

// :server 431 mynick :No nickname given
export const onRaw431 = (ctx: IrcContext): void => {
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

  if (!getIsWizardCompleted()) {
    setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
  }
};

// :server 433 * nick :Nickname is already in use
export const onRaw433 = (ctx: IrcContext): void => {
  ctx.line.shift(); // asterisk
  const nick = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Nickname is already in use') {
    message = i18next.t('kernel.433.nickname-in-use', { defaultValue: message });
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${nick}: ${message}`,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });

  if (!getIsWizardCompleted()) {
    setWizardProgress(0, i18next.t('wizard.loading.error', { message: `${nick}: ${message}` }));
  }
};

// :server 436 mynick nick :Nickname collision KILL
export const onRaw436 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  const message = ctx.trailing();

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message: `${nick}: ${message}`,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.error,
    color: MessageColor.error,
  });
};

// :server 447 mynick :Cannot change nickname while on #channel (+N)
export const onRaw447 = (ctx: IrcContext): void => {
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

export const handlers: IrcHandlers = {
  NICK: onNick,
  [ERR_ERRONEUSNICKNAME]: onRaw432,
  [ERR_NONICKNAMEGIVEN]: onRaw431,
  [ERR_NICKNAMEINUSE]: onRaw433,
  [ERR_NICKCOLLISION]: onRaw436,
  [ERR_NONICKCHANGE]: onRaw447,
};
