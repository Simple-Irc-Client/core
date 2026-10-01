// Every open DM window is MONITOR/WATCH-subscribed while open, independently of Friends; status lands in features/monitor

import { getIsConnected, isSameName } from '@features/settings/store/settings';
import { addMonitoredNicks, removeMonitoredNick, renameMonitoredNick } from '@features/monitor/store/monitor';
import { subscribeNicks, unsubscribeNicks } from '@features/monitor/subscribe';
import { getOpenDmNicks, setRenameChannel } from '@features/channels/store/channels';
import { isFriend, renameFriend } from '@features/friends/friends';

export const subscribeDmPresence = (nick: string): void => {
  if (!getIsConnected()) {
    return;
  }
  addMonitoredNicks([nick]);
  subscribeNicks([nick]);
};

/** Keeps the subscription while the nick is still a friend. */
export const unsubscribeDmPresence = (nick: string): void => {
  if (isFriend(nick)) {
    return;
  }
  removeMonitoredNick(nick);
  if (getIsConnected()) {
    unsubscribeNicks([nick]);
  }
};

/** MONITOR/WATCH is keyed by nick string, so an unhandled rename orphans the subscription and friend entry. */
export const handlePresenceNickChange = (oldNick: string, newNick: string): void => {
  const wasFriend = isFriend(oldNick);
  const hadOpenDm = getOpenDmNicks().some((nick) => isSameName(nick, oldNick));

  if (!wasFriend && !hadOpenDm) {
    return;
  }

  renameMonitoredNick(oldNick, newNick);
  if (getIsConnected()) {
    unsubscribeNicks([oldNick]);
    subscribeNicks([newNick]);
  }

  if (wasFriend) {
    renameFriend(oldNick, newNick);
  }

  if (hadOpenDm) {
    setRenameChannel(oldNick, newNick);
  }
};

// Module scope: the Kernel is constructed per event
let resubscribedThisConnection = false;

/** On 001. */
export const resetDmPresenceSubscription = (): void => {
  resubscribedThisConnection = false;
};

/** At end of MOTD, once per connection. */
export const subscribeDmPresenceOnRegistration = (): void => {
  if (resubscribedThisConnection) {
    return;
  }
  resubscribedThisConnection = true;
  const nicks = getOpenDmNicks();
  if (nicks.length === 0) {
    return;
  }
  addMonitoredNicks(nicks);
  subscribeNicks(nicks);
};
