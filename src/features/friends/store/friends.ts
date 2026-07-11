/**
 * Friends List Store (persisted)
 *
 * Holds the user's friend nicks, keyed per IRC network (same key as
 * serverPasswords: Server.network). This is the durable list; runtime
 * online/offline status lives in the monitor store and is re-derived by
 * re-subscribing (MONITOR/WATCH) after every registration.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface FriendsStore {
  /** Friend nicks per network, in insertion order, display case preserved */
  friendsByNetwork: Record<string, string[]>;

  /** Add nick to a network's friends list (case-insensitive dedupe) */
  addFriend: (network: string, nick: string) => void;
  /** Remove nick from a network's friends list */
  removeFriend: (network: string, nick: string) => void;
}

export const useFriendsStore = create<FriendsStore>()(
  devtools(
    persist(
      (set) => ({
        friendsByNetwork: {},

        addFriend: (network: string, nick: string): void => {
          set((state) => {
            const friends = state.friendsByNetwork[network] ?? [];
            if (friends.some((friend) => friend.toLowerCase() === nick.toLowerCase())) {
              return state;
            }
            return { friendsByNetwork: { ...state.friendsByNetwork, [network]: [...friends, nick] } };
          });
        },

        removeFriend: (network: string, nick: string): void => {
          set((state) => {
            const friends = state.friendsByNetwork[network];
            if (friends === undefined) {
              return state;
            }
            const remaining = friends.filter((friend) => friend.toLowerCase() !== nick.toLowerCase());
            if (remaining.length === friends.length) {
              return state;
            }
            if (remaining.length === 0) {
              return { friendsByNetwork: Object.fromEntries(Object.entries(state.friendsByNetwork).filter(([key]) => key !== network)) };
            }
            return { friendsByNetwork: { ...state.friendsByNetwork, [network]: remaining } };
          });
        },
      }),
      {
        name: 'sic-friends',
        version: 1,
      },
    ),
  ),
);

// Helper functions for external use

export const getFriendsForNetwork = (network: string): string[] => {
  return useFriendsStore.getState().friendsByNetwork[network] ?? [];
};

export const isFriendOnNetwork = (network: string, nick: string): boolean => {
  return getFriendsForNetwork(network).some((friend) => friend.toLowerCase() === nick.toLowerCase());
};
