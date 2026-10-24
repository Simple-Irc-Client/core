import { isIrcService } from '@/network/irc/helpers';

/** How long after the user writes to a service its replies still answer that */
export const SERVICE_REPLY_WINDOW_MS = 15_000;

// `@tags PRIVMSG target :text`, the tags optional
const PRIVMSG_TARGET = /^(?:@\S+ )?PRIVMSG (\S+) /i;

/** By lowercased service nick: the window the user last wrote to it from, and when */
const requests = new Map<string, { window: string; at: number }>();

/** Notes a line the user sends from `window`, when it is addressed to a service */
export const noteServiceRequest = (line: string, window: string, now = Date.now()): void => {
  const target = PRIVMSG_TARGET.exec(line)?.[1];
  if (target !== undefined && isIrcService(target)) {
    requests.set(target.toLowerCase(), { window, at: now });
  }
};

/** Where a service's reply goes when the server can't label it: the window the user just wrote to it from */
export const serviceRequestWindow = (service: string, now = Date.now()): string | undefined => {
  const request = requests.get(service.toLowerCase());
  return request !== undefined && now - request.at <= SERVICE_REPLY_WINDOW_MS ? request.window : undefined;
};

export const clearServiceRequests = (): void => {
  requests.clear();
};
