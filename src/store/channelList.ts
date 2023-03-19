import { create } from 'zustand';
import { type ChannelList } from '../types';
import { persist } from 'zustand/middleware';

interface ChannelListStore {
  channels: ChannelList[];
  finished: boolean;

  setAddChannel: (name: string, users: number, topic: string) => void;
  setClear: () => void;
  setFinished: (status: boolean) => void;
}

export const useChannelListStore = create<ChannelListStore>()(
  persist(
    (set) => ({
      channels: [],
      finished: false,

      setAddChannel: (name: string, users: number, topic: string): void => {
        set((state) => ({
          channels: [...state.channels, { name, users, topic }],
        }));
      },
      setClear: (): void => {
        set(() => ({
          channels: [],
        }));
      },
      setFinished: (status: boolean): void => {
        set(() => ({
          finished: status,
        }));
      },
    }),
    { name: 'channels-list' }
  )
);

export const setAddChannelToList = (name: string, users: number, topic: string): void => {
  if (name === '*') {
    return;
  }

  useChannelListStore.getState().setAddChannel(name, users, topic);
};

export const setChannelListClear = (): void => {
  useChannelListStore.getState().setClear();
};

export const setChannelListFinished = (status: boolean): void => {
  if (status && useChannelListStore.getState().channels.length < 10) {
    return;
  }

  useChannelListStore.getState().setFinished(status);
};

export const getChannelListSortedByAZ = (): ChannelList[] => {
  const channels = useChannelListStore.getState().channels.map((channel) => channel); // fix Cannot assign to read only property '0' of object '[object Array]
  return channels.sort((a: ChannelList, b: ChannelList) => {
    const A = a.name.toLowerCase();
    const B = b.name.toLowerCase();
    return A < B ? -1 : A > B ? 1 : 0;
  });
};

export const getChannelListSortedByUsers = (): ChannelList[] => {
  const channels = useChannelListStore.getState().channels.map((channel) => channel); // fix Cannot assign to read only property '0' of object '[object Array]
  return channels.sort((a: ChannelList, b: ChannelList) => {
    const A = a.users ?? 0;
    const B = b.users ?? 0;
    return A < B ? 1 : A > B ? -1 : 0;
  });
};
