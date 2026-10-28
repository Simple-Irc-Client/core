// https://codeberg.org/emersion/soju/src/branch/master/doc/ext/bouncer-networks.md

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { activeSlice, updateActiveSlice, useActiveSlice, type NetworkSlices } from '@features/networks/store/networkSlices';

/** One of the user's networks on the bouncer; attributes as the bouncer reports them (name, host, port, state, error, ...) */
export interface BouncerNetwork {
  id: string;
  attributes: Record<string, string>;
}

interface BouncerNetworksSlice {
  networks: BouncerNetwork[];
  /** BOUNCER_NETID: the network this connection is bound to; none on the bouncer's own connection */
  boundNetworkId: string | undefined;
}

const NO_BOUNCER_NETWORKS: BouncerNetworksSlice = { networks: [], boundNetworkId: undefined };

interface BouncerNetworksStore extends NetworkSlices<BouncerNetworksSlice> {
  /** `undefined` values remove an attribute: an update carries only what changed */
  updateNetwork: (id: string, attributes: Record<string, string | undefined>) => void;
  removeNetwork: (id: string) => void;
  setBoundNetworkId: (id: string) => void;
  clearAll: () => void;
}

const mergeAttributes = (current: Record<string, string>, update: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(
    Object.entries({ ...current, ...update }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

export const useBouncerNetworksStore = create<BouncerNetworksStore>()(
  devtools((set) => ({
    byNetwork: {},
    emptySlice: NO_BOUNCER_NETWORKS,

    updateNetwork: (id: string, attributes: Record<string, string | undefined>): void => {
      set((state) => updateActiveSlice(state, (slice) => {
        const existing = slice.networks.find((network) => network.id === id);
        if (existing === undefined) {
          return { networks: [...slice.networks, { id, attributes: mergeAttributes({}, attributes) }] };
        }
        return {
          networks: slice.networks.map((network) => (network.id === id ? { id, attributes: mergeAttributes(network.attributes, attributes) } : network)),
        };
      }));
    },
    removeNetwork: (id: string): void => {
      set((state) => updateActiveSlice(state, (slice) => ({ networks: slice.networks.filter((network) => network.id !== id) })));
    },
    setBoundNetworkId: (id: string): void => {
      set((state) => updateActiveSlice(state, () => ({ boundNetworkId: id })));
    },
    clearAll: (): void => {
      set((state) => updateActiveSlice(state, () => NO_BOUNCER_NETWORKS));
    },
  })),
);

/** The bouncer networks the active network's connection reports */
export const useActiveBouncerNetworks = <T>(selector: (slice: BouncerNetworksSlice) => T): T => useActiveSlice(useBouncerNetworksStore, selector);

export const updateBouncerNetwork = (id: string, attributes: Record<string, string | undefined>): void => {
  useBouncerNetworksStore.getState().updateNetwork(id, attributes);
};

export const removeBouncerNetwork = (id: string): void => {
  useBouncerNetworksStore.getState().removeNetwork(id);
};

export const setBoundBouncerNetworkId = (id: string): void => {
  useBouncerNetworksStore.getState().setBoundNetworkId(id);
};

export const getBoundBouncerNetworkId = (): string | undefined => activeSlice(useBouncerNetworksStore.getState()).boundNetworkId;

export const clearBouncerNetworks = (): void => {
  useBouncerNetworksStore.getState().clearAll();
};
