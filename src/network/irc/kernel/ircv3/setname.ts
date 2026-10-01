import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { getUserModes } from '@features/settings/store/settings';
import { getUserChannels, setUserRealname } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// IRCv3 setname
// :nick!user@host SETNAME :New Real Name
export const onSetname = (ctx: IrcContext): void => {
  const { nick } = parseNick(ctx.sender, getUserModes());
  const realname = ctx.trailing();

  if (realname) {
    setUserRealname(nick, realname);

    const channels = getUserChannels(nick);
    for (const channelName of channels) {
      setAddMessage({
        id: ctx.tags.msgid ?? uuidv4(),
        message: i18next.t('kernel.setname', { nick, realname }),
        target: channelName,
        time: ctx.tags.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  }
};

export const handlers: IrcHandlers = {
  SETNAME: onSetname,
};
