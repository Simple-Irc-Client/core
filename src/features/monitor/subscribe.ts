// Shared by friends and DM presence, so both respect the server's limit

import { getMonitorLimit, getWatchLimit } from '@features/settings/store/settings';
import { ircMonitorAdd, ircMonitorRemove, ircWatchAdd, ircWatchRemove } from '@/network/irc/network';

// Nick bytes per command, well below the 512-byte line limit
const MAX_NICKS_BYTES = 400;

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
