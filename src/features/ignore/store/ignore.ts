// Persisted per network

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { rekeyLegacyNetworks } from '@features/networks/legacyStorage';
import { isSameName } from '@features/networks/store/networks';

interface IgnoreStore {
  /** `nick!user@host` masks, insertion order */
  masksByNetwork: Record<string, string[]>;

  /** Dedupes per the server's CASEMAPPING */
  addMask: (network: string, mask: string) => void;
  removeMask: (network: string, mask: string) => void;
}

export const useIgnoreStore = create<IgnoreStore>()(
  devtools(
    persist(
      (set) => ({
        masksByNetwork: {},

        addMask: (network: string, mask: string): void => {
          set((state) => {
            const masks = state.masksByNetwork[network] ?? [];
            if (masks.some((existing) => isSameName(existing, mask))) {
              return state;
            }
            return { masksByNetwork: { ...state.masksByNetwork, [network]: [...masks, mask] } };
          });
        },

        removeMask: (network: string, mask: string): void => {
          set((state) => {
            const masks = state.masksByNetwork[network];
            if (masks === undefined) {
              return state;
            }
            const remaining = masks.filter((existing) => !isSameName(existing, mask));
            if (remaining.length === masks.length) {
              return state;
            }
            if (remaining.length === 0) {
              return { masksByNetwork: Object.fromEntries(Object.entries(state.masksByNetwork).filter(([key]) => key !== network)) };
            }
            return { masksByNetwork: { ...state.masksByNetwork, [network]: remaining } };
          });
        },
      }),
      {
        name: 'sic-ignore',
        version: 2,
        // An older version kept a bouncer's networks under its name
        migrate: (persisted) => {
          const state = persisted as Pick<IgnoreStore, 'masksByNetwork'>;
          return { ...state, masksByNetwork: rekeyLegacyNetworks(state.masksByNetwork ?? {}) };
        },
      },
    ),
  ),
);

export const getIgnoreMasksForNetwork = (network: string): string[] => {
  return useIgnoreStore.getState().masksByNetwork[network] ?? [];
};
