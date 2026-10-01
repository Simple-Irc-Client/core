import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { getUserModes } from '@features/settings/store/settings';
import { setUserAccount } from '@features/users/store/users';

// IRCv3 account-notify
// :nick!user@host ACCOUNT accountname
// :nick!user@host ACCOUNT *  (logged out)
export const onAccount = (ctx: IrcContext): void => {
  const { nick } = parseNick(ctx.sender, getUserModes());
  const account = ctx.line[0];

  if (!account || account === '*') {
    setUserAccount(nick, null);
  } else {
    setUserAccount(nick, account);
  }
};

export const handlers: IrcHandlers = {
  ACCOUNT: onAccount,
};
