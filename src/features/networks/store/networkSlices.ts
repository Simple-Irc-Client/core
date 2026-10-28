// A store that keeps its data per network: one slice of it for each network

import { type StoreApi, type UseBoundStore } from 'zustand';
import { type NetworkId } from '../networkId';
import { getActiveNetworkId, NO_NETWORK, useNetworksStore } from './networks';

export interface NetworkSlices<Slice> {
  byNetwork: Record<NetworkId, Slice>;
  /** What a network's slice holds before anything is written to it */
  emptySlice: Slice;
}

/** The active network's slice */
export const activeSlice = <Slice>(state: NetworkSlices<Slice>): Slice => state.byNetwork[getActiveNetworkId()] ?? state.emptySlice;

/** A store update that changes only the active network's slice; an update that returns the slice itself changes nothing */
export const updateActiveSlice = <Slice extends object>(
  state: NetworkSlices<Slice>,
  update: (slice: Slice) => Partial<Slice>,
): Partial<NetworkSlices<Slice>> => {
  const networkId = getActiveNetworkId();
  const slice = state.byNetwork[networkId] ?? state.emptySlice;
  const changes = update(slice);
  if (changes === slice) {
    return state;
  }
  return { byNetwork: { ...state.byNetwork, [networkId]: { ...slice, ...changes } } };
};

/** Re-renders when the active network changes, as well as when its slice does */
export const useActiveSlice = <Store extends NetworkSlices<Store['emptySlice']>, T>(
  useStore: UseBoundStore<StoreApi<Store>>,
  selector: (slice: Store['emptySlice']) => T,
): T => {
  const networkId = useNetworksStore((state) => state.activeNetworkId) ?? NO_NETWORK;
  return useStore((state) => selector(state.byNetwork[networkId] ?? state.emptySlice));
};
