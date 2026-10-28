// Each network's windows are saved under its own key, and loaded once the network is used

import { type Channel, type ChannelExtended, type Message } from '@shared/types';
import { maxMessages } from '@/config/config';
import { useCurrentStore } from '@features/chat/store/current';
import { flushCurrentUsers } from '@features/users/store/users';
import { createNetworkStorage, type NetworkStorage } from '@shared/lib/idbStorage';
import { foldName } from '@shared/lib/caseMapping';
import { type NetworkId } from '@features/networks/networkId';
import { legacyChannelKeys } from '@features/networks/legacyStorage';
import { getActiveNetworkId, getCurrentChannelName, isSameName, NO_NETWORK, useNetworksStore } from '@features/networks/store/networks';
import { NO_CHANNELS, useChannelsStore, type ChannelsSlice } from './channels';

const CHANNELS_STORAGE = 'sic-channels';
const CHANNELS_VERSION = 3;

interface SavedChannels {
  state: ChannelsSlice;
  version: number;
}

// Merges legacy case-duplicate channels (#religie / #Religie). Folds with `ascii`, which is safe under every CASEMAPPING
const mergeCaseDuplicates = <T extends { name?: unknown }>(
  channels: unknown,
  merge: (existing: T, duplicate: T) => T,
): T[] => {
  if (!Array.isArray(channels)) {
    return [];
  }

  const byFoldedName = new Map<string, T>();

  for (const channel of channels as T[]) {
    if (channel === null || typeof channel !== 'object' || typeof channel.name !== 'string') {
      continue;
    }

    const key = foldName(channel.name, 'ascii');
    const existing = byFoldedName.get(key);
    byFoldedName.set(key, existing === undefined ? channel : merge(existing, channel));
  }

  return [...byFoldedName.values()];
};

const mergeMessages = (existing: Message[], duplicate: Message[]): Message[] => {
  const seenIds = new Set(existing.map((message) => message.id));

  return [...existing, ...duplicate.filter((message) => !seenIds.has(message.id))]
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(-maxMessages);
};

// E2EE messages never reach disk (plaintext would outlive forward secrecy). Returns the same object when nothing is stripped
const stripUnpersisted = (channel: ChannelExtended): ChannelExtended => {
  const hasTyping = channel.typing.length > 0;
  const hasEncrypted = channel.messages.some((message) => message.e2ee !== undefined);

  if (!hasTyping && !hasEncrypted) {
    return channel;
  }

  return {
    ...channel,
    ...(hasTyping ? { typing: [] as string[] } : {}),
    ...(hasEncrypted ? { messages: channel.messages.filter((message) => message.e2ee === undefined) } : {}),
  };
};

/** What of a network's windows is saved */
export const toSavedChannels = (slice: ChannelsSlice): ChannelsSlice => ({
  openChannels: slice.openChannels.map((channel) => stripUnpersisted(channel)),
  openChannelsShortList: slice.openChannelsShortList,
});

export const migrateChannels = (persisted: unknown, version: number): ChannelsSlice => {
  const state = persisted as ChannelsSlice;

  if (version < 2) {
    return {
      ...state,
      openChannels: mergeCaseDuplicates<ChannelExtended>(state?.openChannels, (existing, duplicate) => ({
        ...existing,
        messages: mergeMessages(existing.messages ?? [], duplicate.messages ?? []),
        ...(existing.topic ? {} : { topic: duplicate.topic, topicSetBy: duplicate.topicSetBy, topicSetTime: duplicate.topicSetTime }),
        unReadMessages: (existing.unReadMessages ?? 0) + (duplicate.unReadMessages ?? 0),
        hasMention: existing.hasMention === true || duplicate.hasMention === true,
        avatar: existing.avatar ?? duplicate.avatar,
        displayName: existing.displayName ?? duplicate.displayName,
        typing: [],
      })),
      openChannelsShortList: mergeCaseDuplicates<Channel>(state?.openChannelsShortList, (existing, duplicate) => ({
        ...existing,
        unReadMessages: (existing.unReadMessages ?? 0) + (duplicate.unReadMessages ?? 0),
        hasMention: existing.hasMention === true || duplicate.hasMention === true,
        avatar: existing.avatar ?? duplicate.avatar,
        displayName: existing.displayName ?? duplicate.displayName,
      })),
    };
  }

  return state;
};

/** Windows opened before the saved ones were loaded join them; what they learned meanwhile is newer */
export const mergeLoadedChannels = (saved: ChannelsSlice, live: ChannelsSlice): ChannelsSlice => {
  const liveChannel = (name: string): ChannelExtended | undefined => live.openChannels.find((channel) => isSameName(channel.name, name));
  const liveEntry = (name: string): Channel | undefined => live.openChannelsShortList.find((channel) => isSameName(channel.name, name));
  const isSaved = (name: string): boolean => saved.openChannelsShortList.some((channel) => isSameName(channel.name, name));

  return {
    openChannels: [
      ...(saved.openChannels ?? []).map((channel) => {
        const opened = liveChannel(channel.name);
        return opened === undefined ? channel : { ...channel, ...opened, messages: mergeMessages(channel.messages ?? [], opened.messages) };
      }),
      ...live.openChannels.filter((channel) => !isSaved(channel.name)),
    ],
    openChannelsShortList: [
      ...(saved.openChannelsShortList ?? []).map((channel) => ({ ...channel, ...liveEntry(channel.name) })),
      ...live.openChannelsShortList.filter((channel) => !isSaved(channel.name)),
    ],
  };
};

const syncCurrentAfterLoad = (): void => {
  const currentChannelName = getCurrentChannelName();
  const slice = useChannelsStore.getState().byNetwork[getActiveNetworkId()] ?? NO_CHANNELS;
  const channel = slice.openChannels.find((ch) => isSameName(ch.name, currentChannelName));
  if (channel) {
    useCurrentStore.getState().setUpdateMessages([...channel.messages]);
    useCurrentStore.getState().setUpdateTopic(channel.topic);
    useCurrentStore.getState().setUpdateTyping([]);
    flushCurrentUsers();
  }
};

interface ChannelsPersistence {
  /** Resolves once the network's saved windows are in the store */
  loadNetwork: (networkId: NetworkId) => Promise<void>;
  stop: () => void;
}

/** Saves every network's windows as they change, and loads a network's when it becomes the active one */
export const startChannelsPersistence = (storage: NetworkStorage<SavedChannels> = createNetworkStorage<SavedChannels>(CHANNELS_STORAGE)): ChannelsPersistence => {
  const loaded = new Set<NetworkId>();
  const loading = new Map<NetworkId, Promise<void>>();

  const saveNetwork = (networkId: NetworkId): void => {
    const slice = useChannelsStore.getState().byNetwork[networkId];
    if (slice !== undefined && loaded.has(networkId)) {
      storage.save(networkId, { state: toSavedChannels(slice), version: CHANNELS_VERSION });
    }
  };

  const legacyKeys = (networkId: NetworkId): string[] => {
    const server = useNetworksStore.getState().sessions[networkId]?.server;
    return server === undefined ? [] : legacyChannelKeys(CHANNELS_STORAGE, server);
  };

  /** An older version kept a network's windows per server of it; the first found is adopted */
  const readLegacy = async (keys: string[]): Promise<SavedChannels | undefined> => {
    for (const key of keys) {
      const legacy = await storage.loadKey(key);
      if (legacy !== undefined) {
        return legacy;
      }
    }
    return undefined;
  };

  /** Only once the windows are saved under the network are the older keys dropped */
  const moveFromLegacy = async (networkId: NetworkId, keys: string[]): Promise<void> => {
    await storage.saveNow(networkId, { state: toSavedChannels(useChannelsStore.getState().byNetwork[networkId] ?? NO_CHANNELS), version: CHANNELS_VERSION });
    await Promise.all(keys.map((key) => storage.removeKey(key)));
  };

  const load = async (networkId: NetworkId): Promise<void> => {
    const keys = legacyKeys(networkId);
    const own = await storage.load(networkId);
    const saved = own ?? (await readLegacy(keys));

    loaded.add(networkId);
    if (saved !== undefined) {
      const savedChannels = migrateChannels(saved.state, saved.version);
      useChannelsStore.setState((state) => ({
        byNetwork: { ...state.byNetwork, [networkId]: mergeLoadedChannels(savedChannels, state.byNetwork[networkId] ?? state.emptySlice) },
      }));
    }
    // Windows opened while loading would otherwise wait for their next change to be saved
    saveNetwork(networkId);
    if (own === undefined && saved !== undefined) {
      await moveFromLegacy(networkId, keys);
    }
    if (networkId === getActiveNetworkId()) {
      syncCurrentAfterLoad();
    }
  };

  const loadNetwork = (networkId: NetworkId): Promise<void> => {
    if (networkId === NO_NETWORK || loaded.has(networkId)) {
      return Promise.resolve();
    }
    const inFlight = loading.get(networkId) ?? load(networkId).finally(() => loading.delete(networkId));
    loading.set(networkId, inFlight);
    return inFlight;
  };

  // A network's windows are saved only once its saved ones are loaded, or they would be overwritten
  const stopSaving = useChannelsStore.subscribe((state, previous) => {
    for (const [networkId, slice] of Object.entries(state.byNetwork)) {
      if (slice !== previous.byNetwork[networkId]) {
        saveNetwork(networkId);
      }
    }
  });

  const stopLoading = useNetworksStore.subscribe((state, previous) => {
    if (state.activeNetworkId !== undefined && state.activeNetworkId !== previous.activeNetworkId) {
      void loadNetwork(state.activeNetworkId);
    }
  });

  void loadNetwork(getActiveNetworkId());

  return {
    loadNetwork,
    stop: (): void => {
      stopSaving();
      stopLoading();
      storage.dispose();
    },
  };
};
