import * as Sentry from '@sentry/react';
import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { type IrcContext, joinParamsAndText } from '@/network/irc/kernel/context';
import { replyWindow, showReply } from '@/network/irc/kernel/replies';
import { getServer } from '@features/settings/store/settings';
import { redactSensitiveIrc } from '@shared/lib/utils';
import { MessageCategory } from '@shared/types';

// Error replies outside the 400–599 range: STARTTLS, mode params, oper privs, MLOCK, metadata, knock, Unreal
const OUT_OF_RANGE_ERROR_NUMERICS = new Set(['691', '696', '712', '713', '714', '723', '742', '764', '765', '767', '768', '769', '972', '974']);

const isErrorNumeric = (numeric: string): boolean => {
  const value = Number.parseInt(numeric, 10);
  return (value >= 400 && value <= 599) || OUT_OF_RANGE_ERROR_NUMERICS.has(numeric);
};

/**
 * Standard texts of numerics without a handler, as solanum (Libera.Chat; charybdis/ratbox alike), UnrealIRCd and ergo
 * send them. Only an exact match is translated: the same numeric means different things on different servers (489,
 * 480), and a server's own wording is better shown as is than guessed at. Named groups become translation values.
 */
const KNOWN_TEXTS: Record<string, { text: RegExp; key: string }[]> = {
  '263': [{ text: /^This command could not be completed because it has been used recently, and is rate-limited\.$/, key: 'kernel.263.rate-limited' }],
  '407': [
    { text: /^Too many recipients\.$/, key: 'kernel.407.too-many-recipients' },
    { text: /^Too many targets\. The maximum is (?<max>\d+) for (?<command>\S+)\.$/, key: 'kernel.407.too-many-targets' },
  ],
  '438': [
    { text: /^Nick change too fast\. Please wait (?<seconds>\d+) seconds\.$/, key: 'kernel.438.wait-seconds' },
    { text: /^Nick change too fast\. Please try again later\.$/, key: 'kernel.438.try-later' },
  ],
  '439': [{ text: /^Message target change too fast\. Please wait (?<seconds>\d+) seconds$/, key: 'kernel.439.wait-seconds' }],
  '440': [
    { text: /^Services are currently unavailable$/, key: 'kernel.440.services-down' },
    { text: /^Services are currently down\. Please try again later\.$/, key: 'kernel.440.services-down' },
  ],
  '479': [{ text: /^Illegal channel name$/, key: 'kernel.479.illegal-channel-name' }],
  '480': [{ text: /^Cannot join channel \(\+j\) - throttle exceeded, try again later$/, key: 'kernel.480.join-throttled' }],
  '484': [{ text: /^Cannot kick or deop a network service$/, key: 'kernel.484.cannot-kick-service' }],
  '489': [
    { text: /^You're neither voiced nor channel operator$/, key: 'kernel.489.not-voiced-or-op' },
    { text: /^Cannot join channel \(Secure connection is required\)$/, key: 'kernel.489.secure-connection-required' },
  ],
  '491': [
    { text: /^No appropriate operator blocks were found for your host$/, key: 'kernel.491.no-oper-host' },
    { text: /^No O-lines for your host$/, key: 'kernel.491.no-oper-host' },
  ],
  '500': [{ text: /^Too many join requests\. Please wait a while and try again\.$/, key: 'kernel.500.too-many-joins' }],
  '511': [{ text: /^Your silence list is full$/, key: 'kernel.511.silence-list-full' }],
  '512': [{ text: /^Maximum size for WATCH-list is (?<max>\d+) entries$/, key: 'kernel.512.watch-list-full' }],
  '518': [{ text: /^Cannot invite \(\+V\) at channel (?<channel>\S+)$/, key: 'kernel.518.invites-disabled' }],
  '520': [{ text: /^Cannot join channel (?<channel>\S+) \(IRCops only\)$/, key: 'kernel.520.opers-only' }],
  '723': [{ text: /^Insufficient oper privs$/, key: 'kernel.723.insufficient-privs' }],
};

const translateKnownText = (numeric: string, text: string): string => {
  for (const known of KNOWN_TEXTS[numeric] ?? []) {
    const match = known.text.exec(text);
    if (match) {
      return i18next.t(known.key, { ...match.groups, defaultValue: text });
    }
  }
  return text;
};

// Once per numeric per session: enough to see what real networks send that has no handler yet
const reportedNumerics = new Set<string>();

const reportUnhandledNumeric = (ctx: IrcContext): void => {
  if (reportedNumerics.has(ctx.command)) {
    return;
  }
  reportedNumerics.add(ctx.command);

  Sentry.captureMessage(`Unhandled IRC numeric ${ctx.command}`, {
    level: 'info',
    fingerprint: ['unhandled-irc-numeric', ctx.command],
    tags: { numeric: ctx.command, network: getServer()?.network ?? '' },
    extra: { eventLine: redactSensitiveIrc(ctx.eventLine) },
  });
};

// Shown rather than dropped; errors go to the window the user is looking at
// :server 438 mynick newnick :Nick change too fast. Please wait 30 seconds.
export const onUnhandledNumeric = (ctx: IrcContext): void => {
  reportUnhandledNumeric(ctx);
  ctx.line.shift(); // my nick

  const { params, text } = ctx.paramsAndText();
  const message = joinParamsAndText(params, translateKnownText(ctx.command, text));

  if (message === '') {
    return;
  }

  const isError = isErrorNumeric(ctx.command);

  showReply(ctx, {
    message,
    target: isError ? replyWindow(ctx) : STATUS_CHANNEL,
    category: isError ? MessageCategory.error : MessageCategory.info,
  });
};
