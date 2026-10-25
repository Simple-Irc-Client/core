import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, type IrcHandlers, joinParamsAndText } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { existChannel } from '@features/channels/store/channels';
import { handlePeerOffline } from '@features/e2ee/session';
import { MessageCategory } from '@shared/types';

const ERR_NOSUCHNICK = '401';
const ERR_CANNOTSENDTOCHAN = '404';
const ERR_NORECIPIENT = '411';
const ERR_NOTEXTTOSEND = '412';
const ERR_MSGNEEDREGGEDNICK = '415';
const ERR_TARGETTOOFAST = '439';
const ERR_NONONREG = '486';
const ERR_CANTSENDTOUSER = '531';

// :server 401 mynick target :No such nick/channel
export const onRaw401 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const target = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'No such nick/channel') {
    message = i18next.t('kernel.401.no-such-nick-channel', { defaultValue: message });
  }

  if (target) {
    // Fail a pending E2EE offer now rather than after its timeout
    handlePeerOffline(target);
  }

  showReply(ctx, {
    message: `${target}: ${message}`,
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

// :server 404 mynick #channel :Cannot send to channel
export const onRaw404 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  let message = ctx.trailing();

  if (message === 'Cannot send to channel') {
    message = i18next.t('kernel.404.cannot-send-to-channel', { defaultValue: message });
  }

  showReply(ctx, {
    message: `${channel}: ${message}`,
    target: channel ?? STATUS_CHANNEL,
    category: MessageCategory.error,
  });
};

// :server 411 mynick :No recipient given
export const onRaw411 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const message = ctx.trailing();

  showReply(ctx, {
    message,
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

// :server 412 mynick :No text to send
export const onRaw412 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  let message = ctx.trailing();

  if (message === 'No text to send') {
    message = i18next.t('kernel.412.no-text-to-send', { defaultValue: message });
  }

  showReply(ctx, {
    message,
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

// :ruthenium.libera.chat 415 mynick #channel :Cannot send message to channel (+R) - you need to be logged into your NickServ account
// Older servers send ERR_BADMASK with this number: :server 415 mynick *.mask :Bad Server/host mask
export const onRaw415 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const { params, text } = ctx.paramsAndText();
  const [target] = params;
  const message = text === 'Cannot send message to channel (+R) - you need to be logged into your NickServ account'
    ? i18next.t('kernel.415.channel-needs-account', { defaultValue: text })
    : text;

  showReply(ctx, {
    message: joinParamsAndText(params, message),
    target: target !== undefined && existChannel(target) ? target : replyWindow(ctx),
    category: MessageCategory.error,
  });
};

// :server 439 mynick #channel :Message target change too fast. Please wait 30 seconds
// InspIRCd's m_antibear sends one without a target when we connect: :server 439 mynick :This server has anti-spambot mechanisms enabled.
export const onRaw439 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const { params, text } = ctx.paramsAndText();

  if (params.length === 0) {
    showReply(ctx, {
      message: text,
      target: STATUS_CHANNEL,
      category: MessageCategory.info,
    });
    return;
  }

  const seconds = /^Message target change too fast\. Please wait (?<seconds>\d+) seconds$/.exec(text)?.groups?.seconds;
  const message = seconds === undefined ? text : i18next.t('kernel.439.wait-seconds', { seconds, defaultValue: text });

  showReply(ctx, {
    message: joinParamsAndText(params, message),
    target: replyWindow(ctx),
    category: MessageCategory.error,
  });
};

// In the DM window with that user when it is open, where the message was typed
// :server 486 mynick nick :You must log in with services to message this user
// :server 531 mynick nick :You are not permitted to send private messages to this user
export const onPrivateMessageRefused = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const nick = ctx.line.shift();
  const message = ctx.trailing();

  showReply(ctx, {
    message: `${nick}: ${message}`,
    target: nick !== undefined && existChannel(nick) ? nick : replyWindow(ctx),
    category: MessageCategory.error,
  });
};

export const handlers: IrcHandlers = {
  [ERR_NOSUCHNICK]: onRaw401,
  [ERR_CANNOTSENDTOCHAN]: onRaw404,
  [ERR_NORECIPIENT]: onRaw411,
  [ERR_NOTEXTTOSEND]: onRaw412,
  [ERR_MSGNEEDREGGEDNICK]: onRaw415,
  [ERR_TARGETTOOFAST]: onRaw439,
  [ERR_NONONREG]: onPrivateMessageRefused,
  [ERR_CANTSENDTOUSER]: onPrivateMessageRefused,
};
