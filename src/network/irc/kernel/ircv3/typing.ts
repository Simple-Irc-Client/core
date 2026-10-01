import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { existChannel, setAddChannel, setTyping } from '@features/channels/store/channels';
import { subscribeDmPresence } from '@features/dmPresence/dmPresence';
import { getCurrentNick, getUserModes, isSameName } from '@features/settings/store/settings';
import { ChannelCategory, type UserTypingStatus } from '@shared/types';

// @+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie
export const onTagMsg = (ctx: IrcContext): void => {
  const serverUserModes = getUserModes();

  const target = ctx.line.shift();

  if (target === undefined) {
    ctx.logParseError(onTagMsg, 'target');
    return;
  }

  const { nick } = parseNick(ctx.sender, serverUserModes);

  // Our own, echoed back
  if (isSameName(nick, getCurrentNick())) {
    return;
  }

  const status = ctx.tags['+typing'] ?? ctx.tags['+draft/typing'];
  if (status === undefined) {
    return;
  }

  const isPrivMessage = isSameName(target, getCurrentNick());
  const channel = isPrivMessage ? nick : target;

  // So typing shows before the first message
  if (isPrivMessage && !existChannel(channel)) {
    setAddChannel(channel, ChannelCategory.priv);
    subscribeDmPresence(channel);
  }

  setTyping(channel, nick, status as UserTypingStatus);
};

export const handlers: IrcHandlers = {
  TAGMSG: onTagMsg,
};
