import { create } from 'zustand';
import { type Server } from '../models/servers';
import { devtools, persist } from 'zustand/middleware';
import { ChannelCategory, type UserMode } from '../types';
import { setClearUnreadMessages, useChannelsStore } from './channels';
import { useCurrentStore } from './current';
import { useUsersStore } from './users';

export type CreatorStep = 'nick' | 'server' | 'loading' | 'password' | 'channels';

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
  theme: 'modern' | 'classic';
  namesXProtoEnabled: boolean;
  userModes: UserMode[];
  listRequestRemainingSeconds: number;

  setCreatorCompleted: (status: boolean) => void;
  setIsConnecting: (status: boolean) => void;
  setIsConnected: (status: boolean) => void;
  setConnectedTime: (time: number) => void;
  setNick: (newNick: string) => void;
  setServer: (newServer: Server) => void;
  setCreatorStep: (newCreatorStep: CreatorStep) => void;
  setIsPasswordRequired: (status: boolean) => void;
  setCurrentChannelName: (channelName: string, category: ChannelCategory) => void;
  setTheme: (theme: 'modern' | 'classic') => void;
  setNamesXProtoEnabled: (status: boolean) => void;
  setUserModes: (modes: UserMode[]) => void;
  setListRequestRemainingSeconds: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        isConnecting: false,
        isConnected: false,
        isCreatorCompleted: false,
        creatorStep: 'nick',
        nick: '',
        server: undefined,
        isPasswordRequired: undefined,
        connectedTime: 0,
        currentChannelName: 'Status',
        currentChannelCategory: ChannelCategory.status,
        theme: 'modern',
        namesXProtoEnabled: false,
        userModes: [],
        listRequestRemainingSeconds: -1,

        setCreatorCompleted: (status: boolean): void => {
          set(() => ({
            isCreatorCompleted: status,
          }));
        },
        setIsConnecting: (status: boolean): void => {
          set(() => ({ isConnecting: status }));
        },
        setIsConnected: (status: boolean): void => {
          set(() => ({ isConnected: status }));
        },
        setConnectedTime: (time: number): void => {
          set(() => ({ connectedTime: time }));
        },
        setNick: (newNick: string): void => {
          set(() => ({ nick: newNick }));
        },
        setServer: (newServer: Server): void => {
          set(() => ({ server: newServer }));
        },
        setCreatorStep: (newCreatorStep: CreatorStep): void => {
          set(() => ({ creatorStep: newCreatorStep }));
        },
        setIsPasswordRequired: (status: boolean): void => {
          set(() => ({ isPasswordRequired: status }));
        },
        setCurrentChannelName: (channelName: string, category: ChannelCategory): void => {
          set(() => ({
            currentChannelName: channelName,
            currentChannelCategory: category,
          }));
        },
        setTheme: (newTheme: 'modern' | 'classic'): void => {
          set(() => ({ theme: newTheme }));
        },
        setNamesXProtoEnabled: (status: boolean): void => {
          set(() => ({ namesXProtoEnabled: status }));
        },
        setUserModes: (modes: UserMode[]): void => {
          set(() => ({ userModes: modes }));
        },
        setListRequestRemainingSeconds: (seconds: number): void => {
          set(() => ({ listRequestRemainingSeconds: seconds }));
        },
      }),
      {
        name: 'settings',
      }
    )
  )
);

export const setCurrentChannelName = (channelName: string, category: ChannelCategory): void => {
  useSettingsStore.getState().setCurrentChannelName(channelName, category);

  setClearUnreadMessages(channelName);

  useCurrentStore.getState().setUpdateTopic(useChannelsStore.getState().getTopic(channelName));
  useCurrentStore.getState().setUpdateMessages(useChannelsStore.getState().getMessages(channelName));
  useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(channelName));
  useCurrentStore.getState().setUpdateTyping(useChannelsStore.getState().getTyping(channelName));
};
