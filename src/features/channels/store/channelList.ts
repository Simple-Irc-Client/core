import { create } from 'zustand';
import { type ChannelList } from '@shared/types';
import { activeSlice, updateActiveSlice, useActiveSlice, type NetworkSlices } from '@features/networks/store/networkSlices';

const MAX_CHANNELS = 10_000;

interface ChannelListSlice {
  channels: ChannelList[];
  finished: boolean;
  alisMode: boolean;
  listDeprecated: boolean;
}

const NO_CHANNEL_LIST: ChannelListSlice = {
  channels: [],
  finished: false,
  alisMode: false,
  listDeprecated: false,
};

interface ChannelListStore extends NetworkSlices<ChannelListSlice> {
  setAddChannel: (name: string, users: number, topic: string) => void;
  setClear: () => void;
  setFinished: (status: boolean) => void;
  setAlisMode: (mode: boolean) => void;
  setListDeprecated: (deprecated: boolean) => void;
}

export const useChannelListStore = create<ChannelListStore>()((set) => ({
  byNetwork: {},
  emptySlice: NO_CHANNEL_LIST,

  setAddChannel: (name: string, users: number, topic: string): void => {
    set((state) => updateActiveSlice(state, (slice) => ({
      channels: [...slice.channels, { name, users, topic }],
    })));
  },
  setClear: (): void => {
    set((state) => updateActiveSlice(state, () => NO_CHANNEL_LIST));
  },
  setFinished: (status: boolean): void => {
    set((state) => updateActiveSlice(state, () => ({
      finished: status,
    })));
  },
  setAlisMode: (mode: boolean): void => {
    set((state) => updateActiveSlice(state, () => ({
      alisMode: mode,
    })));
  },
  setListDeprecated: (deprecated: boolean): void => {
    set((state) => updateActiveSlice(state, () => ({
      listDeprecated: deprecated,
    })));
  },
}));

/** The active network's channel list */
export const useActiveChannelList = <T>(selector: (slice: ChannelListSlice) => T): T => useActiveSlice(useChannelListStore, selector);

const getChannelList = (): ChannelListSlice => activeSlice(useChannelListStore.getState());

export const setAddChannelToList = (name: string, users: number, topic: string): void => {
  if (name === '*') {
    return; // ignore hidden channels
  }

  const { channels } = getChannelList();

  if (channels.length >= MAX_CHANNELS) { return; }

  const exist = channels.some((channel) => channel.name === name);

  if (!exist) {
    useChannelListStore.getState().setAddChannel(name, users, topic);
  }
};

export const setChannelListClear = (): void => {
  useChannelListStore.getState().setClear();
};

export const setChannelListFinished = (status: boolean): void => {
  useChannelListStore.getState().setFinished(status);
};

export const setAlisMode = (mode: boolean): void => {
  useChannelListStore.getState().setAlisMode(mode);
};

export const getAlisMode = (): boolean => {
  return getChannelList().alisMode;
};

export const setListDeprecated = (deprecated: boolean): void => {
  useChannelListStore.getState().setListDeprecated(deprecated);
};

export const getListDeprecated = (): boolean => {
  return getChannelList().listDeprecated;
};

export const getChannelListCount = (): number => {
  return getChannelList().channels.length;
};

export const getChannelListSortedByAZ = (): ChannelList[] => {
  return [...getChannelList().channels].sort((a: ChannelList, b: ChannelList) => {
    const A = a.name.toLowerCase();
    const B = b.name.toLowerCase();
    return A < B ? -1 : A > B ? 1 : 0;
  });
};

export const getChannelListSortedByUsers = (): ChannelList[] => {
  return [...getChannelList().channels].sort((a: ChannelList, b: ChannelList) => {
    const A = a.users;
    const B = b.users;
    return A < B ? 1 : A > B ? -1 : 0;
  });
};
