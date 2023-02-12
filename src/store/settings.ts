import { create } from "zustand";
import { Server } from "../models/servers";
import { devtools, persist } from "zustand/middleware";
import { ChannelCategory } from "../types";

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
  currentChannelCategory: ChannelCategory;

  setCreatorCompleted: {
    (status: boolean): void;
  };
  setIsConnecting: {
    (status: boolean): void;
  };
  setIsConnected: {
    (status: boolean): void;
  };
  setConnectedTime: {
    (time: number): void;
  };
  setNick: {
    (newNick: string): void;
  };
  setServer: {
    (newServer: Server): void;
  };
  setCreatorStep: {
    (newCreatorStep: CreatorStep): void;
  };
  setIsPasswordRequired: {
    (status: boolean): void;
  };
  setCurrentChannelName: {
    (channel: string, category: ChannelCategory): void;
  };
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
        currentChannelName: "Status",
        currentChannelCategory: ChannelCategory.status,
        // TODO namesXProtoEnabled: false,
        // TODO usersPrefix: [],

        setCreatorCompleted: (status: boolean): void =>
          set(() => ({
            isCreatorCompleted: status,
          })),
        setIsConnecting: (status: boolean): void =>
          set(() => ({ isConnecting: status })),
        setIsConnected: (status: boolean): void =>
          set(() => ({ isConnected: status })),
        setConnectedTime: (time: number): void =>
          set(() => ({ connectedTime: time })),
        setNick: (newNick: string): void => set(() => ({ nick: newNick })),
        setServer: (newServer: Server): void =>
          set(() => ({ server: newServer })),
        setCreatorStep: (newCreatorStep: CreatorStep): void =>
          set(() => ({ creatorStep: newCreatorStep })),
        setIsPasswordRequired: (status: boolean): void =>
          set(() => ({ isPasswordRequired: status })),
        setCurrentChannelName: (
          channel: string,
          category: ChannelCategory
        ): void =>
          set(() => ({
            currentChannelName: channel,
            currentChannelCategory: category,
          })),
      }),
      {
        name: "settings",
      }
    )
  )
);
