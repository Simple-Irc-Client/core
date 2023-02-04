import { create } from "zustand";
import { Server } from "../models/servers";
import { devtools, persist } from "zustand/middleware";

export type CreatorStep =
  | "nick"
  | "server"
  | "loading"
  | "password"
  | "channels";

export interface SettingsStore {
  isConnected: boolean;
  isCreatorCompleted: boolean;
  creatorStep: CreatorStep;
  nick: string;
  server: Server | undefined;
  currentChannelName: string;

  setCreatorCompleted: Function;
  setIsConnected: Function;
  setNick: Function;
  setServer: Function;
  setCreatorStep: Function;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        isConnected: false,
        isCreatorCompleted: false,
        creatorStep: "nick",
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
        setIsConnected: (status: boolean) =>
          set(() => ({ isConnected: status })),
        setNick: (newNick: string) => set(() => ({ nick: newNick })),
        setServer: (newServer: Server) => set(() => ({ server: newServer })),
        setCreatorStep: (newCreatorStep: CreatorStep) =>
          set(() => ({ creatorStep: newCreatorStep })),
      }),
      {
        name: "settings",
      }
    )
  )
);
