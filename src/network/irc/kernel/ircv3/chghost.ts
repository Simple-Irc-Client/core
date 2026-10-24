import i18next from '@/app/i18n';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { STATUS_CHANNEL } from '@/config/config';
import { getCurrentNick, getUserModes, isSameName } from '@features/settings/store/settings';
import { getUserChannels, setUserHost } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';

// IRCv3 chghost
// :nick!user@host CHGHOST newuser newhost
export const onChghost = (ctx: IrcContext): void => {
  const { nick } = parseNick(ctx.sender, getUserModes());
  const newIdent = ctx.line[0];
  const newHostname = ctx.line[1];

  if (newIdent && newHostname) {
    setUserHost(nick, newIdent, newHostname);

    // Ours comes once per connection (a vhost being applied), not as news for each channel
    const windows = isSameName(nick, getCurrentNick()) ? [STATUS_CHANNEL] : getUserChannels(nick);
    for (const window of windows) {
      showReply(ctx, {
        message: i18next.t('kernel.chghost', { nick, ident: newIdent, hostname: newHostname }),
        target: window,
        category: MessageCategory.info,
      });
    }
  }
};

export const handlers: IrcHandlers = {
  CHGHOST: onChghost,
};
