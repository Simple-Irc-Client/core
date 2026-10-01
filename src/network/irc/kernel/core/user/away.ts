import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage, setAddMessageToAllChannels } from '@features/channels/store/channels';
import { getCurrentChannelName, getUserModes, setCurrentUserFlag } from '@features/settings/store/settings';
import { setUserAway } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_AWAY = '301';
const RPL_UNAWAY = '305';
const RPL_NOWAWAY = '306';

// IRCv3 away-notify
// @account=wariatnakaftan;msgid=THDuCqdstQzWng1N5ALKi4;time=2023-03-23T17:04:33.953Z :wariatnakaftan!uid502816@vhost:far.away AWAY
// @account=wariatnakaftan;msgid=k9mhVRzgAdqLBnnr2YboOh;time=2023-03-23T17:14:37.516Z :wariatnakaftan!uid502816@vhost:far.away AWAY :Auto-away
export const onAway = (ctx: IrcContext): void => {
  const { nick } = parseNick(ctx.sender, getUserModes());
  const reason = ctx.trailingOptional();

  if (reason) {
    setUserAway(nick, true, reason);
  } else {
    setUserAway(nick, false);
  }
};

// :chmurka.pirc.pl 301 sic-test Noop :gone
export const onRaw301 = (ctx: IrcContext): void => {
  const currentChannelName = getCurrentChannelName();

  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  let reason = ctx.line.join(' ');
  if (reason.startsWith(':')) {
    reason = reason.substring(1);
  }

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: i18next.t('kernel.301', { user, reason: reason.length !== 0 ? `(${reason})` : '' }),
    target: currentChannelName,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};

// :insomnia.pirc.pl 305 mero-test-2354324234 :You are no longer marked as being away
export const onRaw305 = (ctx: IrcContext): void => {
  const myNick = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'You are no longer marked as being away') {
    message = i18next.t('kernel.305.you-are-no-longer-marked-as-being-away');
  }

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });

  setCurrentUserFlag("away", false);
  if (myNick) { setUserAway(myNick, false); }
};

// :bzyk.pirc.pl 306 mero-test-2354324234 :You have been marked as being away
export const onRaw306 = (ctx: IrcContext): void => {
  const myNick = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'You have been marked as being away') {
    message = i18next.t('kernel.306.you-have-been-marked-as-being-away');
  }

  setAddMessageToAllChannels({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });

  setCurrentUserFlag("away", true);
  if (myNick) { setUserAway(myNick, true); }
};

export const handlers: IrcHandlers = {
  AWAY: onAway,
  [RPL_AWAY]: onRaw301,
  [RPL_UNAWAY]: onRaw305,
  [RPL_NOWAWAY]: onRaw306,
};
