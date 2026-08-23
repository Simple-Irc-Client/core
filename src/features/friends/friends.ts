/**
 * Friends list actions.
 *
 * Bridges the persisted friends store with the IRC protocol: friends are
 * saved per network and re-subscribed after every registration, preferring
 * IRCv3 MONITOR and falling back to WATCH on servers without it. Servers
 * that support neither still keep the persisted list (shown offline).
 */

import { getIsConnected, getNickLenLimit, getServer, isSameName } from '@features/settings/store/settings';
import { addMonitoredNicks, removeMonitoredNick } from '@features/monitor/store/monitor';
import { subscribeNicks, unsubscribeNicks } from '@features/monitor/subscribe';
import { getOpenDmNicks } from '@features/channels/store/channels';
import { isValidNick } from '@shared/lib/utils';
import { getFriendsForNetwork, isFriendOnNetwork, useFriendsStore } from './store/friends';

const getNetworkKey = (): string | undefined => getServer()?.network;

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

/**
 * Remove a friend: unpersist it and, when connected, unsubscribe — unless an
 * open DM window still wants this nick's status, in which case that window
 * (see features/dmPresence) now owns the subscription and it must stay up.
 */
export const removeFriend = (nick: string): void => {
  const network = getNetworkKey();
  if (network === undefined) {
    return;
  }
  useFriendsStore.getState().removeFriend(network, nick);
  if (getOpenDmNicks().some((open) => isSameName(open, nick))) {
    return;
  }
  removeMonitoredNick(nick);
  if (getIsConnected()) {
    unsubscribeNicks([nick]);
  }
};

/**
 * Rename a friend in place after observing their NICK change. A no-op if
 * `oldNick` isn't a friend. Purely a data rename — the MONITOR/WATCH
 * subscription for the nick is owned centrally by
 * features/dmPresence's `handlePresenceNickChange`, which calls this.
 */
export const renameFriend = (oldNick: string, newNick: string): void => {
  const network = getNetworkKey();
  if (network === undefined) {
    return;
  }
  useFriendsStore.getState().renameFriend(network, oldNick, newNick);
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
