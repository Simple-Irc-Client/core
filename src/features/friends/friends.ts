// Per network; MONITOR, else WATCH, else the list is just shown offline

import { getIsConnected, getNickLenLimit, getServer, isSameName } from '@features/settings/store/settings';
import { addMonitoredNicks, removeMonitoredNick } from '@features/monitor/store/monitor';
import { subscribeNicks, unsubscribeNicks } from '@features/monitor/subscribe';
import { getOpenDmNicks } from '@features/channels/store/channels';
import { isValidNick } from '@shared/lib/utils';
import { getFriendsForNetwork, isFriendOnNetwork, useFriendsStore } from './store/friends';

const getNetworkKey = (): string | undefined => getServer()?.network;

export const getFriends = (): string[] => {
  const network = getNetworkKey();
  return network === undefined ? [] : getFriendsForNetwork(network);
};

export const isFriend = (nick: string): boolean => {
  const network = getNetworkKey();
  return network !== undefined && isFriendOnNetwork(network, nick);
};

/** False for an invalid nick or no configured network. */
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

/** Keeps the subscription while a DM window with the nick is open. */
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

/** Data only: the subscription is handled by handlePresenceNickChange. */
export const renameFriend = (oldNick: string, newNick: string): void => {
  const network = getNetworkKey();
  if (network === undefined) {
    return;
  }
  useFriendsStore.getState().renameFriend(network, oldNick, newNick);
};

// Module scope (the Kernel is per event); otherwise a manual /motd would re-send the whole MONITOR list
let subscribedThisConnection = false;

/** On 001. */
export const resetFriendsSubscription = (): void => {
  subscribedThisConnection = false;
};

/** At end of MOTD (after 005 set the limits), once per connection. */
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
