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
  isConnecting: boolean;
  isConnected: boolean;
  isCreatorCompleted: boolean;
  creatorStep: CreatorStep;
  nick: string;
  server: Server | undefined;
  // currentChannelName: string;
  isPasswordRequired: boolean | undefined;

  setCreatorCompleted: Function;
  setIsConnecting: Function;
  setIsConnected: Function;
  setNick: Function;
  setServer: Function;
  setCreatorStep: Function;
  setIsPasswordRequired: Function;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        isConnecting: false,
        isConnected: false,
        isCreatorCompleted: false,
        creatorStep: "nick",
        nick: "",
        server: undefined,
        isPasswordRequired: undefined,
        // currentChannelName: "",
        // currentChannelCategory: '',
        // passwordRequired: false,
        // channelsList: [],
        // namesXProtoEnabled: false,
        // usersPrefix: [],

        setCreatorCompleted: (status: boolean) =>
          set(() => ({
            isCreatorCompleted: status,
          })),
        setIsConnecting: (status: boolean) =>
          set(() => ({ isConnecting: status })),
        setIsConnected: (status: boolean) =>
          set(() => ({ isConnected: status })),
        setNick: (newNick: string) => set(() => ({ nick: newNick })),
        setServer: (newServer: Server) => set(() => ({ server: newServer })),
        setCreatorStep: (newCreatorStep: CreatorStep) =>
          set(() => ({ creatorStep: newCreatorStep })),
        setIsPasswordRequired: (status: boolean) =>
          set(() => ({ isPasswordRequired: status })),
      }),
      {
        name: "settings",
      }
    )
  )
);
