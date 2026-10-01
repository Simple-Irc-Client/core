import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { subscribeDmPresenceOnRegistration } from '@features/dmPresence/dmPresence';
import { subscribeFriendsOnRegistration } from '@features/friends/friends';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_MOTD = '372';
const RPL_MOTDSTART = '375';
const RPL_ENDOFMOTD = '376';
const ERR_NOMOTD = '422';

// :saturn.pirc.pl 372 SIC-test :- 2/6/2022 11:27
export const onRaw372 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 375 SIC-test :- saturn.pirc.pl Message of the Day -
export const onRaw375 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 376 SIC-test :End of /MOTD command.
export const onRaw376 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });

  // 005 limits are known by now
  subscribeFriendsOnRegistration();
  subscribeDmPresenceOnRegistration();
};

// :server 422 mynick :MOTD File is missing
export const onRaw422 = (ctx: IrcContext): void => {
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

  // No MOTD still ends the registration burst
  subscribeFriendsOnRegistration();
  subscribeDmPresenceOnRegistration();
};

export const handlers: IrcHandlers = {
  [RPL_MOTD]: onRaw372,
  [RPL_MOTDSTART]: onRaw375,
  [RPL_ENDOFMOTD]: onRaw376,
  [ERR_NOMOTD]: onRaw422,
};
