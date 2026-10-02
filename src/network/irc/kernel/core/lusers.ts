import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { MessageCategory } from '@shared/types';

const RPL_STATSCONN = '250';
const RPL_LUSERCLIENT = '251';
const RPL_LUSEROP = '252';
const RPL_LUSERUNKNOWN = '253';
const RPL_LUSERCHANNELS = '254';
const RPL_LUSERME = '255';
const RPL_LOCALUSERS = '265';
const RPL_GLOBALUSERS = '266';

// :tantalum.libera.chat 250 Merovingian :Highest connection count: 2682 (2681 clients) (389463 connections received)
export const onRaw250 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 251 SIC-test :There are 158 users and 113 invisible on 10 servers
export const onRaw251 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 252 SIC-test 27 :operator(s) online
export const onRaw252 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.line.join(' ');

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 253 SIC-test -14 :unknown connection(s)
export const onRaw253 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.line.join(' ');

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 254 SIC-test 185 :channels formed
export const onRaw254 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.line.join(' ');

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 255 SIC-test :I have 42 clients and 0 servers
export const onRaw255 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 265 SIC-test 42 62 :Current local users 42, max 62
export const onRaw265 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  ctx.line.shift(); // local
  ctx.line.shift(); // max

  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

// :saturn.pirc.pl 266 SIC-test 271 1721 :Current global users 271, max 1721
export const onRaw266 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  ctx.line.shift(); // global
  ctx.line.shift(); // max

  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: STATUS_CHANNEL,
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_STATSCONN]: onRaw250,
  [RPL_LUSERCLIENT]: onRaw251,
  [RPL_LUSEROP]: onRaw252,
  [RPL_LUSERUNKNOWN]: onRaw253,
  [RPL_LUSERCHANNELS]: onRaw254,
  [RPL_LUSERME]: onRaw255,
  [RPL_LOCALUSERS]: onRaw265,
  [RPL_GLOBALUSERS]: onRaw266,
};
