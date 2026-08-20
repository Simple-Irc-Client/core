/**
 * SIC-E2EE v1 — trust-on-first-use pins (persisted).
 *
 * The first time we complete a handshake with someone, their long-term identity
 * key is recorded here. Every later handshake is checked against it, and a key
 * that has changed blocks the session instead of silently re-keying. This is
 * exactly the `known_hosts` model: it cannot detect an attacker who was already
 * in the middle at first contact, but it makes every *later* substitution
 * visible, and the fingerprint shown in the UI is what closes the remaining gap
 * for users who compare it out of band.
 *
 * Pins are keyed per network (same key as `serverPasswords` and the friends
 * list) and, within a network, by services account where one is known.
 * Preferring the account matters: nicks on IRC are transient — someone else can
 * hold `bob` next week — while a registered account is a durable identity. Nick
 * is the fallback for unregistered peers, and is marked as the weaker key so the
 * UI can say so.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { foldName } from '@shared/lib/caseMapping';
import { getCaseMapping } from '@/features/settings/store/settings';

export interface E2eePin {
  /** Base64 SPKI of the peer's long-term identity key. */
  identityKeyB64: string;
  /** Cached fingerprint of `identityKeyB64`, so the UI needn't re-hash. */
  fingerprint: string;
  /** ISO timestamp of first contact. */
  firstSeen: string;
  /** True once the user confirmed the fingerprint through another channel. */
  verified: boolean;
}

interface PinsStore {
  /** network -> peer key -> pin */
  pinsByNetwork: Record<string, Record<string, E2eePin>>;
  putPin: (network: string, peerKey: string, pin: E2eePin) => void;
  setPinVerified: (network: string, peerKey: string, verified: boolean) => void;
  removePin: (network: string, peerKey: string) => void;
  clearNetwork: (network: string) => void;
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

        removePin: (network: string, peerKey: string): void => {
          set((state) => {
            const networkPins = state.pinsByNetwork[network];
            if (!networkPins || !(peerKey in networkPins)) {
              return state;
            }
            const remaining = Object.fromEntries(Object.entries(networkPins).filter(([key]) => key !== peerKey));
            if (Object.keys(remaining).length === 0) {
              return {
                pinsByNetwork: Object.fromEntries(Object.entries(state.pinsByNetwork).filter(([key]) => key !== network)),
              };
            }
            return { pinsByNetwork: { ...state.pinsByNetwork, [network]: remaining } };
          });
        },

        clearNetwork: (network: string): void => {
          set((state) => ({
            pinsByNetwork: Object.fromEntries(Object.entries(state.pinsByNetwork).filter(([key]) => key !== network)),
          }));
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

/**
 * Build the per-network identifier for a peer.
 *
 * The `account:`/`nick:` prefixes keep the two namespaces from colliding, and
 * let callers tell at a glance whether a pin is anchored to something durable.
 *
 * The nick fallback folds with the server's actual negotiated casemapping —
 * the same one `store/e2ee.ts`'s `getSessionKey` uses — rather than assuming
 * a default. Folding differently between the two would mean a pin and the
 * session it is supposed to guard could disagree on whether two nicks are the
 * same peer (rfc1459 folds `{}|^` together with `[]\~`; plain ascii does not),
 * silently breaking the pin lookup for exactly the servers that differ.
 */
export const getPeerKey = (nick: string, account?: string): string =>
  account && account.length > 0 ? `account:${account.toLowerCase()}` : `nick:${foldName(nick, getCaseMapping())}`;

/** True when this pin is anchored to a registered account rather than a reusable nick. */
export const isAccountPeerKey = (peerKey: string): boolean => peerKey.startsWith('account:');

// Helper functions for external use

export const getPin = (network: string, peerKey: string): E2eePin | undefined =>
  useE2eePinsStore.getState().pinsByNetwork[network]?.[peerKey];

export const putPin = (network: string, peerKey: string, pin: E2eePin): void => {
  useE2eePinsStore.getState().putPin(network, peerKey, pin);
};

export const setPinVerified = (network: string, peerKey: string, verified: boolean): void => {
  useE2eePinsStore.getState().setPinVerified(network, peerKey, verified);
};

export const removePin = (network: string, peerKey: string): void => {
  useE2eePinsStore.getState().removePin(network, peerKey);
};
