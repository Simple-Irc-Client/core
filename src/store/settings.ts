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
  isPasswordRequired: boolean | undefined;
  connectedTime: number; // unix timestamp
  currentChannelName: string;
  openChannels: string[];

  setCreatorCompleted: Function;
  setIsConnecting: Function;
  setIsConnected: Function;
  setConnectedTime: Function;
  setNick: Function;
  setServer: Function;
  setCreatorStep: Function;
  setIsPasswordRequired: Function;
  setCurrentChannelName: Function;
  setAddOpenChannel: Function;
  setRemoveOpenChannel: Function;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        isConnecting: false,
        isConnected: false,
        isCreatorCompleted: false,
        creatorStep: "nick",
        nick: "",
        server: undefined,
        isPasswordRequired: undefined,
        connectedTime: 0,
        currentChannelName: "",
        // currentChannelCategory: '',
        openChannels: [],
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
        setConnectedTime: (time: number) =>
          set(() => ({ connectedTime: time })),
        setCurrentChannelName: (channel: string) =>
          set(() => ({ currentChannelName: channel })),
        setAddOpenChannel: (channel: string) =>
          set((state) => ({ openChannels: [...state.openChannels, channel] })),
        setRemoveOpenChannel: (channel: string) =>
          set((state) => ({
            openChannels: state.openChannels.filter((name) => name !== channel),
          })),
      }),
      {
        name: "settings",
      }
    )
  )
);
