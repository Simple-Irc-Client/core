// https://ircv3.net/specs/extensions/standard-replies

import { onHistoryFailed } from '@/network/irc/chatHistory';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';

// @time=2026-10-22T06:51:42.985Z :ergo.test FAIL CHATHISTORY INVALID_TARGET BEFORE #nochan :Messages could not be retrieved
export const onFail = (ctx: IrcContext): void => {
  const [command, , ...context] = ctx.paramsAndText().params;

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
