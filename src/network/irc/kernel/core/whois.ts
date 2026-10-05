import i18next from '@/app/i18n';
import { parseChannel } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { getUserModes } from '@features/settings/store/settings';
import { setUserBot } from '@features/users/store/users';
import { getDateFnsLocale } from '@shared/lib/dateLocale';
import { MessageCategory } from '@shared/types';
import { format } from 'date-fns';

const RPL_WHOISCERTFP = '276';
const RPL_WHOISREGNICK = '307';
const RPL_WHOISHELPOP = '310';
const RPL_WHOISUSER = '311';
const RPL_WHOISSERVER = '312';
const RPL_WHOISOPERATOR = '313';
const RPL_WHOISIDLE = '317';
const RPL_ENDOFWHOIS = '318';
const RPL_WHOISCHANNELS = '319';
const RPL_WHOISSPECIAL = '320';
const RPL_WHOISLOGGEDIN = '330';
const RPL_WHOISBOT = '335';
const RPL_WHOISACTUALLY = '338';
const RPL_WHOISCOUNTRY = '344';
const RPL_WHOISHOST = '378';
const RPL_WHOISMODES = '379';
const RPL_WHOISSECURE = '671';

// :chmurka.pirc.pl 276 sic-test k4be :has client certificate fingerprint 56fca76
export const onRaw276 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.276', { user, message }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 307 sic-test Noop :is identified for this nick
export const onRaw307 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'is identified for this nick') {
    message = i18next.t('kernel.307.is-identified-for-this-nick');
  }

  showReply(ctx, {
    message: i18next.t('kernel.307', { user, message }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 311 sic-test Noop ~Noop ukryty-29093CCD.compute-1.amazonaws.com * :*
export const onRaw311 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const host = ctx.line.join(' ');

  showReply(ctx, {
    message: i18next.t('kernel.311', { user, host }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 312 sic-test Noop insomnia.pirc.pl :IRC lepszy od spania!
export const onRaw312 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();

  const server = ctx.line.shift();

  const description = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.312', { user, server, description: description.length !== 0 ? `(${description})` : '' }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 313 sic-test k4be :is an IRC Operator
export const onRaw313 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();

  let message = ctx.trailing();

  if (message === 'is an IRC Operator') {
    message = i18next.t('kernel.313.is-an-irc-operator');
  }
  if (message === 'is a Network Service') {
    message = i18next.t('kernel.313.is-a-network-service');
  }

  showReply(ctx, {
    message: i18next.t('kernel.313', { user, message }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 318 sic-test Noop :End of /WHOIS list.
export const onRaw318 = (): void => {
  // Nothing to do
};

// :chmurka.pirc.pl 319 sic-test Noop :@#onet_quiz @#scc @#sic
export const onRaw319 = (ctx: IrcContext): void => {
  const serverUserModes = getUserModes();

  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const channels = ctx.trailing()
    .split(' ')
    .map((channel) => parseChannel(channel, serverUserModes))
    .join(' ');

  showReply(ctx, {
    message: i18next.t('kernel.319', { user, channels }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 310 mynick nick :is available for help
export const onRaw310 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.310', { user, message }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 320 sic-test k4be :a Network Administrator
export const onRaw320 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();

  let message = ctx.trailing();

  if (message === 'a Network Administrator') {
    message = i18next.t('kernel.320.a-network-administrator');
  }

  showReply(ctx, {
    message: i18next.t('kernel.320', { user, message }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 335 sic-test Noop :is a \u0002Bot\u0002 on pirc.pl
export const onRaw335 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();

  if (user !== undefined) {
    setUserBot(user, true);
  }

  showReply(ctx, {
    message: i18next.t('kernel.335', { user }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :chmurka.pirc.pl 671 sic-test Noop :is using a Secure Connection
export const onRaw671 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();

  let message = ctx.trailing();

  if (message === 'is using a Secure Connection') {
    message = i18next.t('kernel.671.is-using-a-secure-connection');
  }

  showReply(ctx, {
    message: i18next.t('kernel.671', { user, message }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 317 mynick user idle signon :seconds idle, signon time
export const onRaw317 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const idleSeconds = Number(ctx.line.shift() ?? '0');
  const signonTime = Number(ctx.line.shift() ?? '0');

  const idleFormatted = formatDuration(idleSeconds);
  const signonDate = signonTime > 0 ? format(new Date(signonTime * 1000), 'd MMM yyyy HH:mm', { locale: getDateFnsLocale() }) : '';

  showReply(ctx, {
    message: i18next.t('kernel.317', { user, idle: idleFormatted, signon: signonDate, defaultValue: `${user} idle ${idleFormatted}, signed on ${signonDate}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

export const formatDuration = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) { parts.push(`${days}d`); }
  if (hours > 0) { parts.push(`${hours}h`); }
  if (minutes > 0) { parts.push(`${minutes}m`); }
  if (secs > 0 || parts.length === 0) { parts.push(`${secs}s`); }

  return parts.join(' ');
};

// :server 330 mynick user account :is logged in as
export const onRaw330 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const account = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'is logged in as') {
    message = i18next.t('kernel.330.is-logged-in-as', { defaultValue: 'is logged in as' });
  }

  showReply(ctx, {
    message: i18next.t('kernel.330', { user, account, message, defaultValue: `${user} ${message} ${account}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 338 mynick user actualuser@actualhost actualIP :Actual user@host, Actual IP
export const onRaw338 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const actualUserHost = ctx.line.shift();
  const actualIP = ctx.line.shift();

  showReply(ctx, {
    message: i18next.t('kernel.338', { user, actualUserHost, actualIP, defaultValue: `${user} ${actualUserHost} ${actualIP}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 344 mynick user country :is connecting from Country
export const onRaw344 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const country = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.344', { user, country, message, defaultValue: `${user} ${message} ${country}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 378 mynick nick :is connecting from *@host IP
export const onRaw378 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.378', { user, message, defaultValue: `* ${user} ${message}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

// :server 379 mynick nick :is using modes +iwx
export const onRaw379 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const user = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: i18next.t('kernel.379', { user, message, defaultValue: `* ${user} ${message}` }),
    target: replyWindow(ctx),
    category: MessageCategory.info,
  });
};

export const handlers: IrcHandlers = {
  [RPL_WHOISCERTFP]: onRaw276,
  [RPL_WHOISREGNICK]: onRaw307,
  [RPL_WHOISUSER]: onRaw311,
  [RPL_WHOISSERVER]: onRaw312,
  [RPL_WHOISOPERATOR]: onRaw313,
  [RPL_ENDOFWHOIS]: onRaw318,
  [RPL_WHOISCHANNELS]: onRaw319,
  [RPL_WHOISHELPOP]: onRaw310,
  [RPL_WHOISSPECIAL]: onRaw320,
  [RPL_WHOISBOT]: onRaw335,
  [RPL_WHOISSECURE]: onRaw671,
  [RPL_WHOISIDLE]: onRaw317,
  [RPL_WHOISLOGGEDIN]: onRaw330,
  [RPL_WHOISACTUALLY]: onRaw338,
  [RPL_WHOISCOUNTRY]: onRaw344,
  [RPL_WHOISHOST]: onRaw378,
  [RPL_WHOISMODES]: onRaw379,
};
