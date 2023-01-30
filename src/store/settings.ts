import { create, State } from "zustand";
import { Server } from "../models/servers";

interface SettingsStore {
  isCreatorCompleted: boolean;
  creatorStep: number;
  nick: string;
  server: Server | undefined;
  currentChannelName: string;
  setCreatorCompleted: Function;
  setNick: Function;
  setCreatorStep: Function;
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
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
  setNick: (newNick: string) => set((state) => ({ nick: newNick })),
  setCreatorStep: (newCreatorStep: number) => set((state) => ({ creatorStep: newCreatorStep }))
}));
