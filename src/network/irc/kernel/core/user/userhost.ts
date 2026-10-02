import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { addReply } from '@/network/irc/kernel/replies';
import { getCurrentChannelName } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';

const RPL_USERHOST = '302';
const RPL_USERIP = '340';

// Replies to /userhost and /userip, shown where the command was typed
// :server 302 mynick :alice=+alice@host.example bob*=-bob@host.example
// :server 340 mynick :alice=+alice@192.0.2.1
export const onUserhostReply = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  addReply(ctx, {
    message: ctx.trailing(),
    target: getCurrentChannelName(),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_USERHOST]: onUserhostReply,
  [RPL_USERIP]: onUserhostReply,
};
