import { create } from 'zustand';
import { type ChannelList } from '../types';
import { devtools } from 'zustand/middleware';

export interface ChannelListStore {
  channels: ChannelList[];
  finished: boolean;

  setAddChannel: (name: string, users: number, topic: string) => void;
  setClearList: () => void;
  setFinished: (status: boolean) => void;
  getChannelsSortedByAZ: () => ChannelList[];
}

export const useChannelListStore = create<ChannelListStore>()(
  devtools(
    (set, get) => ({
      channels: [],
      finished: false,

      setAddChannel: (name: string, users: number, topic: string): void => {
        set((state) => ({
          channels: [...state.channels, { name, users, topic }],
        }));
      },
      setClearList: (): void => {
        set(() => ({
          channels: [],
          finished: false,
        }));
      },
      setFinished: (status: boolean): void => {
        set(() => ({
          finished: status,
        }));
      },
      getChannelsSortedByAZ: (): ChannelList[] => {
        return get().channels.sort((a: ChannelList, b: ChannelList) => {
          const A = a.name.toLowerCase();
          const B = b.name.toLowerCase();
          return A < B ? -1 : A > B ? 1 : 0;
        });
      },
    }),
    { name: 'channels-list' }
  )
);
