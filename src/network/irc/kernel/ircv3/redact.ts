import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { redacted, setRedacted } from '@features/redaction/redaction';
import { getCurrentNick, getUserModes, isSameName } from '@features/settings/store/settings';

// IRCv3 message-redaction; ours count too, relayed back once the server deleted the message
// @msgid=dJw8Q4rTq;time=2026-10-24T10:00:00.000Z :alice!~u@host REDACT #sic 4KDXxxP5mQbJM9eYuTm3J7 :spam
export const onRedact = (ctx: IrcContext): void => {
  const target = ctx.line[0];
  // Last, it may come as a trailing parameter
  const msgid = ctx.line[1] === undefined ? undefined : ctx.stripColon(ctx.line[1]);
  if (target === undefined || !msgid) {
    return;
  }

  const { nick } = parseNick(ctx.sender, getUserModes());
  const window = isSameName(target, getCurrentNick()) ? nick : target;

  // A replayed redaction may follow its message in the same page, not yet shown
  const page = ctx.history?.page;
  const index = page?.findIndex((message) => message.msgid === msgid && isSameName(message.target, window)) ?? -1;
  const message = page?.[index];
  if (page !== undefined && message !== undefined) {
    page[index] = redacted(message);
  }

  setRedacted(window, msgid);
};

export const handlers: IrcHandlers = {
  REDACT: onRedact,
};
