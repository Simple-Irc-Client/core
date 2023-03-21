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
  channelTypes: string[];
  isMetadataEnabled: boolean;

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
  setChannelTypes: (types: string[]) => void;
  setIsMetadataEnabled: () => void;
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
        channelTypes: [],
        isMetadataEnabled: false,

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
        setChannelTypes: (types: string[]): void => {
          set(() => ({ channelTypes: types }));
        },
        setIsMetadataEnabled: (): void => {
          set(() => ({ isMetadataEnabled: true }));
        },
      }),
      {
        name: 'settings',
      }
    )
  )
);

export const setCreatorCompleted = (status: boolean): void => {
  useSettingsStore.getState().setCreatorCompleted(status);
};

export const setIsConnecting = (status: boolean): void => {
  useSettingsStore.getState().setIsConnecting(status);
};

export const setIsConnected = (status: boolean): void => {
  useSettingsStore.getState().setIsConnected(status);
};

export const setConnectedTime = (time: number): void => {
  useSettingsStore.getState().setConnectedTime(time);
};

export const setNick = (newNick: string): void => {
  useSettingsStore.getState().setNick(newNick);
};

export const setServer = (newServer: Server): void => {
  useSettingsStore.getState().setServer(newServer);
};

export const setCreatorStep = (newCreatorStep: CreatorStep): void => {
  useSettingsStore.getState().setCreatorStep(newCreatorStep);
};

export const setIsPasswordRequired = (status: boolean): void => {
  useSettingsStore.getState().setIsPasswordRequired(status);
};

export const setCurrentChannelName = (channelName: string, category: ChannelCategory): void => {
  useSettingsStore.getState().setCurrentChannelName(channelName, category);

  setClearUnreadMessages(channelName);

  useCurrentStore.getState().setUpdateTopic(useChannelsStore.getState().getTopic(channelName));
  useCurrentStore.getState().setUpdateMessages(useChannelsStore.getState().getMessages(channelName));
  useCurrentStore.getState().setUpdateUsers(useUsersStore.getState().getUsersFromChannelSortedByMode(channelName));
  useCurrentStore.getState().setUpdateTyping(useChannelsStore.getState().getTyping(channelName));
};

export const setTheme = (newTheme: 'modern' | 'classic'): void => {
  useSettingsStore.getState().setTheme(newTheme);
};

export const setNamesXProtoEnabled = (status: boolean): void => {
  useSettingsStore.getState().setNamesXProtoEnabled(status);
};

export const setUserModes = (modes: UserMode[]): void => {
  useSettingsStore.getState().setUserModes(modes);
};

export const setListRequestRemainingSeconds = (seconds: number): void => {
  useSettingsStore.getState().setListRequestRemainingSeconds(seconds);
};

export const setChannelTypes = (types: string[]): void => {
  useSettingsStore.getState().setChannelTypes(types);
};

export const getCurrentNick = (): string => {
  return useSettingsStore.getState().nick;
};

export const getCurrentChannelName = (): string => {
  return useSettingsStore.getState().currentChannelName;
};

export const getCurrentChannelCategory = (): ChannelCategory => {
  return useSettingsStore.getState().currentChannelCategory;
};

export const getChannelTypes = (): string[] => {
  return useSettingsStore.getState().channelTypes;
};

export const getUserModes = (): UserMode[] => {
  return useSettingsStore.getState().userModes;
};

export const getConnectedTime = (): number => {
  return useSettingsStore.getState().connectedTime;
};

export const getIsCreatorCompleted = (): boolean => {
  return useSettingsStore.getState().isCreatorCompleted;
};

export const getIsPasswordRequired = (): boolean | undefined => {
  return useSettingsStore.getState().isPasswordRequired;
};

export const setMetadataEnabled = (): void => {
  useSettingsStore.getState().setIsMetadataEnabled();
};

export const isMetadataEnabled = (): boolean => {
  return useSettingsStore.getState().isMetadataEnabled;
};
