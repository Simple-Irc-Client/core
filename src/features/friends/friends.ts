/**
 * Friends list actions.
 *
 * Bridges the persisted friends store with the IRC protocol: friends are
 * saved per network and re-subscribed after every registration, preferring
 * IRCv3 MONITOR and falling back to WATCH on servers without it. Servers
 * that support neither still keep the persisted list (shown offline).
 */

import { getIsConnected, getMonitorLimit, getNickLenLimit, getServer, getWatchLimit } from '@features/settings/store/settings';
import { ircMonitorAdd, ircMonitorRemove, ircWatchAdd, ircWatchRemove } from '@/network/irc/network';
import { addMonitoredNicks, removeMonitoredNick } from '@features/monitor/store/monitor';
import { isValidNick } from '@shared/lib/utils';
import { getFriendsForNetwork, isFriendOnNetwork, useFriendsStore } from './store/friends';

// Budget for the nick portion of one MONITOR/WATCH command, keeping the full
// line comfortably below the 512-byte IRC limit.
const MAX_NICKS_BYTES = 400;

const getNetworkKey = (): string | undefined => getServer()?.network;

/** Split nicks into chunks that fit a single command line. */
const chunkNicks = (nicks: string[], perNickOverhead: number): string[][] => {
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

const subscribeNicks = (nicks: string[]): void => {
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

const unsubscribeNicks = (nicks: string[]): void => {
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

/** Friends of the currently configured network. */
export const getFriends = (): string[] => {
  const network = getNetworkKey();
  return network === undefined ? [] : getFriendsForNetwork(network);
};

export const isFriend = (nick: string): boolean => {
  const network = getNetworkKey();
  return network !== undefined && isFriendOnNetwork(network, nick);
};

/**
 * Add a friend: persist it and, when connected, subscribe to its status.
 * Returns false when the nick is invalid or no network is configured.
 */
export const addFriend = (nick: string): boolean => {
  const network = getNetworkKey();
  const trimmed = nick.trim();
  if (network === undefined || !isValidNick(trimmed, getNickLenLimit())) {
    return false;
  }
  useFriendsStore.getState().addFriend(network, trimmed);
  if (getIsConnected()) {
    // Seed as offline right away; MONITOR/WATCH replies flip it online.
    addMonitoredNicks([trimmed]);
    subscribeNicks([trimmed]);
  }
  return true;
};

/** Remove a friend: unpersist it and, when connected, unsubscribe. */
export const removeFriend = (nick: string): void => {
  const network = getNetworkKey();
  if (network === undefined) {
    return;
  }
  useFriendsStore.getState().removeFriend(network, nick);
  removeMonitoredNick(nick);
  if (getIsConnected()) {
    unsubscribeNicks([nick]);
  }
};

// The Kernel is constructed per event, so the once-per-connection guard for
// the registration subscription lives here at module scope. Without it a
// manual /motd (which replays 376) would re-send the whole MONITOR list.
let subscribedThisConnection = false;

/** Reset the subscription guard; the kernel calls this on 001. */
export const resetFriendsSubscription = (): void => {
  subscribedThisConnection = false;
};

/**
 * Re-subscribe all persisted friends. Called by the kernel at end of MOTD
 * (376/422) — after the 005 burst set the MONITOR/WATCH limits — and only
 * effective once per connection.
 */
export const subscribeFriendsOnRegistration = (): void => {
  if (subscribedThisConnection) {
    return;
  }
  subscribedThisConnection = true;
  const friends = getFriends();
  if (friends.length === 0) {
    return;
  }
  addMonitoredNicks(friends);
  subscribeNicks(friends);
};
