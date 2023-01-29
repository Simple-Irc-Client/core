import { create, State } from "zustand";
import { Server } from "../models/servers";

interface SettingsStore {
  isCreatorCompleted: boolean;
  nick: string;
  server: Server | undefined;
  currentChannelName: string;
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  isCreatorCompleted: false,
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
}));
