import i18next from '@/app/i18n';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { getUserModes } from '@features/settings/store/settings';
import { getUserChannels, setUserRealname } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';

// IRCv3 setname
// :nick!user@host SETNAME :New Real Name
export const onSetname = (ctx: IrcContext): void => {
  const { nick } = parseNick(ctx.sender, getUserModes());
  const realname = ctx.trailing();

  if (realname) {
    setUserRealname(nick, realname);

    const channels = getUserChannels(nick);
    for (const channelName of channels) {
      showReply(ctx, {
        message: i18next.t('kernel.setname', { nick, realname }),
        target: channelName,
        category: MessageCategory.info,
      });
    }
  }
};

export const handlers: IrcHandlers = {
  SETNAME: onSetname,
};
