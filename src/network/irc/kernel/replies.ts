import { MessageColor } from '@/config/theme';
import { type IrcContext } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
import { getCurrentChannelName } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const colors = {
  [MessageCategory.info]: MessageColor.info,
  [MessageCategory.error]: MessageColor.error,
  [MessageCategory.motd]: MessageColor.info,
} as const;

interface Reply {
  message: string;
  target: string;
  category: keyof typeof colors;
}

/** Where a reply to a command belongs: the window it was sent from, when labeled-response tells; otherwise the current one. */
export const replyWindow = (ctx: IrcContext): string => ctx.request?.window ?? getCurrentChannelName();

/** Shows a server reply in the `target` window; id and time come from the server's tags when it sent them. */
export const showReply = (ctx: IrcContext, { message, target, category }: Reply): void => {
  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target,
    time: ctx.tags.time ?? new Date().toISOString(),
    category,
    color: colors[category],
  });
};
