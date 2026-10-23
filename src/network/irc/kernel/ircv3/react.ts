import { type IrcContext } from '@/network/irc/kernel/context';
import { REACT_TAG, REPLY_TAG, setReaction, UNREACT_TAG, withReaction } from '@features/reactions/reactions';
import { getCurrentNick, isSameName } from '@features/settings/store/settings';

const applyReaction = (ctx: IrcContext, window: string, msgid: string, emoji: string, nick: string, isAdded: boolean): void => {
  // A replayed reaction usually follows its message in the same page, not yet shown; the page may repeat one shown already
  const page = ctx.history?.page;
  const index = page?.findIndex((message) => message.msgid === msgid && isSameName(message.target, window)) ?? -1;
  const message = page?.[index];
  if (page !== undefined && message !== undefined) {
    page[index] = { ...message, reactions: withReaction(message.reactions, emoji, nick, isAdded) };
  }

  setReaction(window, msgid, emoji, nick, isAdded);
};

// @+draft/react=👍;+draft/reply=Lmhr6R5PLKZtXcN3qDNSV6;msgid=4KDXxxP5mQbJM9eYuTm3J7;time=2026-10-23T10:15:00.000Z :alice!~u@host TAGMSG #sic
// Ours count too: echoed back, or sent by another client on the same bouncer
export const onReaction = (ctx: IrcContext, nick: string, target: string): void => {
  const msgid = ctx.tags[REPLY_TAG];
  if (!msgid) {
    return;
  }

  const window = isSameName(target, getCurrentNick()) ? nick : target;
  const react = ctx.tags[REACT_TAG];
  const unreact = ctx.tags[UNREACT_TAG];

  if (react) {
    applyReaction(ctx, window, msgid, react, nick, true);
  }
  if (unreact) {
    applyReaction(ctx, window, msgid, unreact, nick, false);
  }
};
