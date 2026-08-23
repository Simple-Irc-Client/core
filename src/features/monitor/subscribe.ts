/**
 * Shared IRCv3 MONITOR / WATCH subscription helpers.
 *
 * Anything that wants to track a nick's online status (friends, DM presence)
 * goes through here so they all respect the same server-advertised limit and
 * chunk nicks onto the wire the same way.
 */

import { getMonitorLimit, getWatchLimit } from '@features/settings/store/settings';
import { ircMonitorAdd, ircMonitorRemove, ircWatchAdd, ircWatchRemove } from '@/network/irc/network';

// Budget for the nick portion of one MONITOR/WATCH command, keeping the full
// line comfortably below the 512-byte IRC limit.
const MAX_NICKS_BYTES = 400;

/** Split nicks into chunks that fit a single command line. */
export const chunkNicks = (nicks: string[], perNickOverhead: number): string[][] => {
  const chunks: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const nick of nicks) {
    const cost = nick.length + perNickOverhead;
    if (current.length > 0 && bytes + cost > MAX_NICKS_BYTES) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(nick);
    bytes += cost;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
};

export const subscribeNicks = (nicks: string[]): void => {
  if (getMonitorLimit() > 0) {
    for (const chunk of chunkNicks(nicks, ','.length)) {
      ircMonitorAdd(chunk);
    }
  } else if (getWatchLimit() > 0) {
    for (const chunk of chunkNicks(nicks, ' +'.length)) {
      ircWatchAdd(chunk);
    }
  }
};

export const unsubscribeNicks = (nicks: string[]): void => {
  if (getMonitorLimit() > 0) {
    for (const chunk of chunkNicks(nicks, ','.length)) {
      ircMonitorRemove(chunk);
    }
  } else if (getWatchLimit() > 0) {
    for (const chunk of chunkNicks(nicks, ' -'.length)) {
      ircWatchRemove(chunk);
    }
  }
};
