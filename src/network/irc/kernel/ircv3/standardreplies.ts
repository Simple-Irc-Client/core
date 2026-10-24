// https://ircv3.net/specs/extensions/standard-replies

import { STATUS_CHANNEL } from '@/config/config';
import { onBouncerFailed } from '@/network/irc/bouncer';
import { onHistoryFailed } from '@/network/irc/chatHistory';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

// :soju.test FAIL BOUNCER INVALID_NETID 77 :Unknown network ID
// @time=2026-10-22T06:51:42.985Z :ergo.test FAIL CHATHISTORY INVALID_TARGET BEFORE #nochan :Messages could not be retrieved
// :ergo.test FAIL REDACT REDACT_FORBIDDEN #sic 4KDXxxP5mQbJM9eYuTm3J7 :You are not authorized to delete this message
// :ergo.test FAIL METADATA KEY_INVALID avatar! :Invalid key name
export const onFail = (ctx: IrcContext): void => {
  const { params, text } = ctx.paramsAndText();
  const [command, , ...context] = params;

  switch (command) {
    case 'BOUNCER':
      showReply(ctx, { message: text, target: STATUS_CHANNEL, category: MessageCategory.error });
      onBouncerFailed();
      return;
    // A message the user tried to delete
    case 'REDACT':
      showReply(ctx, { message: text, target: replyWindow(ctx), category: MessageCategory.error });
      return;
    // Context: <subcommand> <target>. Asked for by the client itself: the window just shows no more history
    case 'CHATHISTORY':
      if (context[1] !== undefined) {
        onHistoryFailed(context[1]);
      }
      return;
    // The client's own read markers
    case 'MARKREAD':
    case undefined:
      return;
  }

  // A request the client made on its own is no news to the user
  if (ctx.request?.automatic === true) {
    return;
  }

  // Where its command was typed, or with the server's other messages when the server can't say
  showReply(ctx, { message: text, target: ctx.request?.window ?? STATUS_CHANNEL, category: MessageCategory.error });
};

export const handlers: IrcHandlers = {
  FAIL: onFail,
};
