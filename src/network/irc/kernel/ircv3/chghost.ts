import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { getUserModes } from '@features/settings/store/settings';
import { getUserChannels, setUserHost } from '@features/users/store/users';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// IRCv3 chghost
// :nick!user@host CHGHOST newuser newhost
export const onChghost = (ctx: IrcContext): void => {
  const { nick } = parseNick(ctx.sender, getUserModes());
  const newIdent = ctx.line[0];
  const newHostname = ctx.line[1];

  if (newIdent && newHostname) {
    setUserHost(nick, newIdent, newHostname);

    const channels = getUserChannels(nick);
    for (const channelName of channels) {
      setAddMessage({
        id: ctx.tags.msgid ?? uuidv4(),
        message: i18next.t('kernel.chghost', { nick, ident: newIdent, hostname: newHostname }),
        target: channelName,
        time: ctx.tags.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  }
};

export const handlers: IrcHandlers = {
  CHGHOST: onChghost,
};
