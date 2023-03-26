import { create } from 'zustand';
import { type Server } from '../models/servers';
import { devtools, persist } from 'zustand/middleware';
import { ChannelCategory, type UserMode } from '../types';
import { setClearUnreadMessages, useChannelsStore } from './channels';
import { useCurrentStore } from './current';
import { useUsersStore } from './users';
import { defaultChannelType } from '../config/config';

export type CreatorStep = 'nick' | 'server' | 'loading' | 'password' | 'channels';

export interface CreatorProgress {
  value: number;
  label?: string;
}

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
  userModes: UserMode[];
  listRequestRemainingSeconds: number;
  channelTypes: string[];
  supportedOptions: string[];
  creatorProgress: CreatorProgress;

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
  setUserModes: (modes: UserMode[]) => void;
  setListRequestRemainingSeconds: (seconds: number) => void;
  setChannelTypes: (types: string[]) => void;
  setSupportedOption: (option: string) => void;
  setCreatorProgress: (value: number, label: string) => void;
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
        userModes: [],
        listRequestRemainingSeconds: -1,
        channelTypes: [],
        supportedOptions: [],
        creatorProgress: { value: 0, label: '' },

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
        setUserModes: (modes: UserMode[]): void => {
          set(() => ({ userModes: modes }));
        },
        setListRequestRemainingSeconds: (seconds: number): void => {
          set(() => ({ listRequestRemainingSeconds: seconds }));
        },
        setChannelTypes: (types: string[]): void => {
          set(() => ({ channelTypes: types }));
        },
        setSupportedOption: (option: string): void => {
          set((state) => ({ supportedOptions: [...state.supportedOptions, option] }));
        },
        setCreatorProgress: (value: number, label: string): void => {
          set(() => ({ creatorProgress: { value, label } }));
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
  return useSettingsStore.getState().channelTypes ?? [defaultChannelType];
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

export const setSupportedOption = (key: string): void => {
  useSettingsStore.getState().setSupportedOption(key);
};

export const isSupportedOption = (option: string): boolean => {
  return useSettingsStore.getState().supportedOptions.includes(option);
};

export const setCreatorProgress = (value: number, label: string): void => {
  useSettingsStore.getState().setCreatorProgress(value, label);
};
