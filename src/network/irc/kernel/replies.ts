import { MessageColor } from '@/config/theme';
import { type IrcContext } from '@/network/irc/kernel/context';
import { setAddMessage } from '@features/channels/store/channels';
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

/** A server reply; id and time come from the server's tags when it sent them. */
export const addReply = (ctx: IrcContext, { message, target, category }: Reply): void => {
  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message,
    target,
    time: ctx.tags.time ?? new Date().toISOString(),
    category,
    color: colors[category],
  });
};
