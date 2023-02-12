import { create } from "zustand";
import { ChannelList } from "../types";
import { devtools, persist } from "zustand/middleware";

export interface ChannelListStore {
  channels: ChannelList[];
  finished: boolean;

  setAddChannel: {
    (name: string, users: number, topic: string): void;
  };
  setClearList: {
    (): void;
  };
  setFinished: {
    (status: boolean): void;
  };
}

export const useChannelListStore = create<ChannelListStore>()(
  devtools(
    persist(
      (set) => ({
        channels: [],
        finished: false,

        setAddChannel: (name: string, users: number, topic: string): void =>
          set((state) => ({
            channels: [...state.channels, { name, users, topic }],
          })),
        setClearList: (): void =>
          set(() => ({
            channels: [],
            finished: false,
          })),
        setFinished: (status: boolean): void =>
          set(() => ({
            finished: status,
          })),
      }),
      { name: "channels-list" }
    )
  )
);
