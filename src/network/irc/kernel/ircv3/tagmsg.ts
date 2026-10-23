import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { onReaction } from '@/network/irc/kernel/ircv3/react';
import { onTyping } from '@/network/irc/kernel/ircv3/typing';
import { getUserModes } from '@features/settings/store/settings';

// TAGMSG carries client tags only: typing notifications and reactions
export const onTagMsg = (ctx: IrcContext): void => {
  const target = ctx.line.shift();

  if (target === undefined) {
    ctx.logParseError(onTagMsg, 'target');
    return;
  }

  const { nick } = parseNick(ctx.sender, getUserModes());

  onTyping(ctx, nick, target);
  onReaction(ctx, nick, target);
};

export const handlers: IrcHandlers = {
  TAGMSG: onTagMsg,
};
