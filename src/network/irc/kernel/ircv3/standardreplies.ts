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
export const onFail = (ctx: IrcContext): void => {
  const [command, , ...context] = ctx.paramsAndText().params;

  if (command === 'BOUNCER') {
    showReply(ctx, {
      message: ctx.paramsAndText().text,
      target: STATUS_CHANNEL,
      category: MessageCategory.error,
    });
    onBouncerFailed();
  }

  // A message the user tried to delete
  if (command === 'REDACT') {
    showReply(ctx, {
      message: ctx.paramsAndText().text,
      target: replyWindow(ctx),
      category: MessageCategory.error,
    });
  }

  if (command === 'CHATHISTORY') {
    // Context: <subcommand> <target>
    const target = context[1];
    if (target !== undefined) {
      onHistoryFailed(target);
    }
  }
};

export const handlers: IrcHandlers = {
  FAIL: onFail,
};
