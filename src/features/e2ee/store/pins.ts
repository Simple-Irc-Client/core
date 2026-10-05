/**
 * Trust-on-first-use pins, like known_hosts. Per network, then by services account (durable) or nick (weaker,
 * reusable by someone else).
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { foldName } from '@shared/lib/caseMapping';
import { getCaseMapping } from '@/features/settings/store/settings';

export interface E2eePin {
  /** Base64 SPKI */
  identityKeyB64: string;
  fingerprint: string;
  firstSeen: string;
  verified: boolean;
}

interface PinsStore {
  /** network -> peer key -> pin */
  pinsByNetwork: Record<string, Record<string, E2eePin>>;
  putPin: (network: string, peerKey: string, pin: E2eePin) => void;
  setPinVerified: (network: string, peerKey: string, verified: boolean) => void;
}

export const useE2eePinsStore = create<PinsStore>()(
  devtools(
    persist(
      (set) => ({
        pinsByNetwork: {},

        putPin: (network: string, peerKey: string, pin: E2eePin): void => {
          set((state) => ({
            pinsByNetwork: {
              ...state.pinsByNetwork,
              [network]: { ...state.pinsByNetwork[network], [peerKey]: pin },
            },
          }));
        },

        setPinVerified: (network: string, peerKey: string, verified: boolean): void => {
          set((state) => {
            const pin = state.pinsByNetwork[network]?.[peerKey];
            if (!pin) {
              return state;
            }
            return {
              pinsByNetwork: {
                ...state.pinsByNetwork,
                [network]: { ...state.pinsByNetwork[network], [peerKey]: { ...pin, verified } },
              },
            };
          });
        },
      }),
      {
        name: 'sic-e2ee-pins',
        version: 1,
      },
    ),
    { name: 'e2ee-pins' },
  ),
);

/** Folds nicks with the server's casemapping, like getSessionKey, so a pin and its session agree on identity. */
export const getPeerKey = (nick: string, account?: string): string =>
  account && account.length > 0 ? `account:${account.toLowerCase()}` : `nick:${foldName(nick, getCaseMapping())}`;

export const getPin = (network: string, peerKey: string): E2eePin | undefined =>
  useE2eePinsStore.getState().pinsByNetwork[network]?.[peerKey];

export const putPin = (network: string, peerKey: string, pin: E2eePin): void => {
  useE2eePinsStore.getState().putPin(network, peerKey, pin);
};

export const setPinVerified = (network: string, peerKey: string, verified: boolean): void => {
  useE2eePinsStore.getState().setPinVerified(network, peerKey, verified);
};
