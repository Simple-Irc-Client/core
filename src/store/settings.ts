import { create } from "zustand";
import { Server } from "../models/servers";
import { devtools, persist } from "zustand/middleware";

interface SettingsStore {
  isCreatorCompleted: boolean;
  creatorStep: number;
  nick: string;
  server: Server | undefined;
  currentChannelName: string;
  setCreatorCompleted: Function;
  setNick: Function;
  setServer: Function;
  setCreatorStep: Function;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        isCreatorCompleted: false,
        creatorStep: 1,
        nick: "",
        server: undefined,
        currentChannelName: "",
        // currentChannelCategory: '',
        // passwordRequired: false,
        // channelsList: [],
        // namesXProtoEnabled: false,
        // usersPrefix: [],

        setCreatorCompleted: () =>
          set((state) => ({
            isCreatorCompleted: state.isCreatorCompleted,
          })),
        setNick: (newNick: string) => set(() => ({ nick: newNick })),
        setServer: (newServer: Server) => set(() => ({ server: newServer })),
        setCreatorStep: (newCreatorStep: number) =>
          set(() => ({ creatorStep: newCreatorStep })),
      }),
      {
        name: "SIC",
      }
    )
  )
);
