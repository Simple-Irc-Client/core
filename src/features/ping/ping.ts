// Pings asked for with /ping: each carries its send time as the token the answer echoes back

import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// A ping to a channel is answered by each of its users, so answered pings are kept; the oldest go past this many
const MAX_TRACKED_PINGS = 50;

/** Token → the window the ping was asked from */
const trackedPings = new Map<string, string>();

export const newPingToken = (): string => String(Date.now());

export const trackPing = (token: string, window: string): void => {
  trackedPings.set(token, window);
  const oldest = trackedPings.keys().next().value;
  if (trackedPings.size > MAX_TRACKED_PINGS && oldest !== undefined) {
    trackedPings.delete(oldest);
  }
};

/** The window a ping was asked from; undefined for a token this client never sent, so a peer can't make up a time */
export const getPingWindow = (token: string): string | undefined => trackedPings.get(token);

export const forgetPing = (token: string): void => {
  trackedPings.delete(token);
};

/** Shows how long the answer to a tracked ping took, in the window it was asked from */
export const showPingReply = (from: string, token: string, window: string): void => {
  // A backwards clock adjustment would show a negative time
  const milliseconds = Math.max(0, Date.now() - Number(token));
  setAddMessage({
    id: uuidv4(),
    message: i18next.t('ping.reply', { from, milliseconds }),
    target: window,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });
};
