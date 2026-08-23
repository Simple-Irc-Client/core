/**
 * DM presence tracking.
 *
 * Separate from Friends (see features/friends): every currently *open*
 * direct-message window — plain or E2EE, they share ChannelCategory.priv, the
 * encryption state is only a per-message flag — is MONITOR/WATCH-subscribed
 * for as long as its window stays open, regardless of whether the other party
 * is also a saved friend. Closing the window unsubscribes it again.
 *
 * The online/offline status itself lands in the same shared
 * features/monitor/store — the kernel's RPL_MONONLINE/OFFLINE (and WATCH
 * equivalent) handlers already update it for any monitored nick, DM or
 * friend alike.
 */

import { getIsConnected, isSameName } from '@features/settings/store/settings';
import { addMonitoredNicks, removeMonitoredNick, renameMonitoredNick } from '@features/monitor/store/monitor';
import { subscribeNicks, unsubscribeNicks } from '@features/monitor/subscribe';
import { getOpenDmNicks, setRenameChannel } from '@features/channels/store/channels';
import { isFriend, renameFriend } from '@features/friends/friends';

/** Subscribe to a DM peer's online status. Call whenever a DM window opens. */
export const subscribeDmPresence = (nick: string): void => {
  if (!getIsConnected()) {
    return;
  }
  addMonitoredNicks([nick]);
  subscribeNicks([nick]);
};

/**
 * Unsubscribe a DM peer's online status. Call whenever a DM window closes.
 * A no-op when the nick is still monitored for another reason (a friend) —
 * dropping it here would also blind the friends list.
 */
export const unsubscribeDmPresence = (nick: string): void => {
  if (isFriend(nick)) {
    return;
  }
  removeMonitoredNick(nick);
  if (getIsConnected()) {
    unsubscribeNicks([nick]);
  }
};

/**
 * Follow a peer's NICK change: MONITOR/WATCH is keyed by nick string, not
 * identity, so a rename we don't react to silently orphans the subscription
 * (and, if it's a persisted friend, the saved entry) under a nick nobody
 * answers to anymore. A no-op unless `oldNick` is either a friend or has an
 * open DM window — nobody we track cares otherwise.
 */
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

// The Kernel is constructed per event, so the once-per-connection guard for
// the registration re-subscription lives here at module scope, mirroring
// features/friends/friends.ts.
let resubscribedThisConnection = false;

/** Reset the subscription guard; the kernel calls this on 001. */
export const resetDmPresenceSubscription = (): void => {
  resubscribedThisConnection = false;
};

/**
 * Re-subscribe every currently open DM window. Called by the kernel at end
 * of MOTD (376/422), same hook as subscribeFriendsOnRegistration, and only
 * effective once per connection.
 */
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
