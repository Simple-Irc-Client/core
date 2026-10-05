// Persisted per network; online status lives in the monitor store

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { isSameName } from '@features/settings/store/settings';

interface FriendsStore {
  /** Insertion order, display case */
  friendsByNetwork: Record<string, string[]>;

  /** Dedupes per the server's CASEMAPPING */
  addFriend: (network: string, nick: string) => void;
  removeFriend: (network: string, nick: string) => void;
  /** Keeps list order */
  renameFriend: (network: string, oldNick: string, newNick: string) => void;
}

export const useFriendsStore = create<FriendsStore>()(
  devtools(
    persist(
      (set) => ({
        friendsByNetwork: {},

        addFriend: (network: string, nick: string): void => {
          set((state) => {
            const friends = state.friendsByNetwork[network] ?? [];
            if (friends.some((friend) => isSameName(friend, nick))) {
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
            const remaining = friends.filter((friend) => !isSameName(friend, nick));
            if (remaining.length === friends.length) {
              return state;
            }
            if (remaining.length === 0) {
              return { friendsByNetwork: Object.fromEntries(Object.entries(state.friendsByNetwork).filter(([key]) => key !== network)) };
            }
            return { friendsByNetwork: { ...state.friendsByNetwork, [network]: remaining } };
          });
        },

        renameFriend: (network: string, oldNick: string, newNick: string): void => {
          set((state) => {
            const friends = state.friendsByNetwork[network];
            if (friends === undefined) {
              return state;
            }
            const index = friends.findIndex((friend) => isSameName(friend, oldNick));
            if (index === -1) {
              return state;
            }
            const renamed = [...friends];
            renamed[index] = newNick;
            return { friendsByNetwork: { ...state.friendsByNetwork, [network]: renamed } };
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

export const getFriendsForNetwork = (network: string): string[] => {
  return useFriendsStore.getState().friendsByNetwork[network] ?? [];
};

export const isFriendOnNetwork = (network: string, nick: string): boolean => {
  return getFriendsForNetwork(network).some((friend) => isSameName(friend, nick));
};
