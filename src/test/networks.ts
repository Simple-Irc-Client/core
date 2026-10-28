// Tests set and read the active network's session and data the way the app keeps them

import { vi } from 'vitest';
import { type StoreApi, type UseBoundStore } from 'zustand';
import { type Server } from '@/network/irc/servers';
import { activeSlice, type NetworkSlices } from '@features/networks/store/networkSlices';
import { activateNetwork, getActiveNetworkId, useNetworksStore, type NetworkSession } from '@features/networks/store/networks';
import * as networksStore from '@features/networks/store/networks';
import * as settingsStore from '@features/settings/store/settings';
import { type SettingsStore } from '@features/settings/store/settings';

export const TEST_SERVER: Server = { default: 0, encoding: 'utf8', network: 'TestNet', servers: ['irc.test.net'] };

/** Back to no network chosen, with no sessions */
export const resetNetworks = (): void => {
  useNetworksStore.setState({ activeNetworkId: undefined, sessions: {} });
};

/** Chooses `server`'s network, as the wizard does */
export const connectTestNetwork = (server: Server = TEST_SERVER, nick = ''): void => {
  activateNetwork(server, nick);
};

export const setTestSession = (patch: Partial<NetworkSession>): void => {
  useNetworksStore.getState().updateSession(getActiveNetworkId(), patch);
};

type SlicedStore<Store> = UseBoundStore<StoreApi<Store>>;

/** The active network's slice of `store` */
export const testSlice = <Store extends NetworkSlices<Store['emptySlice']>>(store: SlicedStore<Store>): Store['emptySlice'] => activeSlice(store.getState());

/** Merges `patch` into the active network's slice of `store` */
export const setTestSlice = <Store extends NetworkSlices<Store['emptySlice']>>(store: SlicedStore<Store>, patch: Partial<Store['emptySlice']>): void => {
  const networkId = getActiveNetworkId();
  store.setState((state) => ({
    byNetwork: { ...state.byNetwork, [networkId]: { ...(state.byNetwork[networkId] ?? state.emptySlice), ...patch } },
  }) as Partial<Store>);
};

/** Every network's data of `store` gone */
export const clearTestSlices = <Store extends NetworkSlices<Store['emptySlice']>>(store: SlicedStore<Store>): void => {
  store.setState({ byNetwork: {} } as Partial<Store>);
};

/** For a test that feeds components a made-up state: settings and the active network's session are both read from it */
export const mockStoreState = (state: object): void => {
  vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) => selector(state as SettingsStore));
  vi.spyOn(networksStore, 'useActiveSession').mockImplementation((selector) => selector(state as NetworkSession));
};
