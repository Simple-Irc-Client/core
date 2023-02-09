import { create } from "zustand";
import { ChannelList } from "../types";
import { devtools, persist } from "zustand/middleware";

export interface ChannelListStore {
  channels: ChannelList[];
  finished: boolean;

  setAddChannel: Function;
  setClearList: Function;
  setFinished: Function;
}

export const useChannelListStore = create<ChannelListStore>()(
  devtools(
    persist(
      (set) => ({
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
      }),
      { name: "channels-list" }
    )
  )
);
