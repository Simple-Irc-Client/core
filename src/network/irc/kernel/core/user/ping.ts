import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { ircSendRawMessage } from '@/network/irc/network';
import { setLagMs } from '@features/settings/store/settings';

// PING :F549DB3
export const onPing = (ctx: IrcContext): void => {
  const param = ctx.line[0] ?? '';
  ircSendRawMessage(`PONG ${param}`);
};

// @msgid=MIikH9lopbKqOQpz8ADjfP;time=2023-03-20T23:07:21.701Z :chmurka.pirc.pl PONG chmurka.pirc.pl :1679353641686
export const onPong = (ctx: IrcContext): void => {
  // The keepalive sends `PING :<Date.now()>`, echoed back here: that's the lag
  const token = ctx.line[ctx.line.length - 1];
  if (token === undefined) {
    return;
  }
  const sentAt = Number.parseInt(ctx.stripColon(token), 10);
  if (!Number.isNaN(sentAt)) {
    // A backwards clock adjustment would show negative lag
    setLagMs(Math.max(0, Date.now() - sentAt));
  }
};

export const handlers: IrcHandlers = {
  PING: onPing,
  PONG: onPong,
};
