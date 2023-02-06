import { create } from "zustand";
import { Channel } from "../types";

export interface ChannelListStore {
  channels: Channel[];
  finished: boolean;

  setAddChannel: Function;
  setClearList: Function;
  setFinished: Function;
}

export const useChannelListStore = create<ChannelListStore>()((set, get) => ({
  channels: [],
  finished: false,

  setAddChannel: (name: string, users: number, topic: string) =>
    set((state) => ({
      channels: [...state.channels, { name, users, topic }],
    })),
  setClearList: () =>
    set(() => ({
      channels: [],
      finished: false,
    })),
  setFinished: (status: boolean) =>
    set(() => ({
      finished: status,
    })),
}));
