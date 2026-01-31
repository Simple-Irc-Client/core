import { create } from 'zustand';
import { type Server } from '@/network/irc/servers';
import { devtools } from 'zustand/middleware';
import { ChannelCategory, type ChannelMode, type UserMode } from '@shared/types';
import { getMessages, getTopic, getTyping, setClearUnreadMessages, setChannelsClearAll } from '@features/channels/store/channels';
import { useCurrentStore, setCurrentClearAll } from '@features/chat/store/current';
import { getUsersFromChannelSortedByMode, setUsersClearAll } from '@features/users/store/users';
import { defaultChannelTypes } from '@/config/config';
import { setChannelListClear } from '@features/channels/store/channelList';
import { ircDisconnect } from '@/network/irc/network';

export type WizardStep = 'init' | 'nick' | 'server' | 'loading' | 'password' | 'channels';

export interface WizardProgress {
  value: number;
  label?: string;
}

export interface FontFormatting {
  colorCode: number | null; // IRC color code (0-98) or null for no color
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export type FontSize = 'small' | 'medium' | 'large';

export interface SettingsStore {
  isConnecting: boolean;
  isConnected: boolean;
  isWizardCompleted: boolean;
  wizardStep: WizardStep;
  nick: string;
  server: Server | undefined;
  isPasswordRequired: boolean | undefined;
  connectedTime: number; // unix timestamp
  currentChannelName: string;
  currentChannelCategory: ChannelCategory;
  theme: 'modern' | 'classic';
  userModes: UserMode[];
  channelModes: ChannelMode;
  listRequestRemainingSeconds: number;
  channelTypes: string[];
  supportedOptions: string[];
  wizardProgress: WizardProgress;
  currentUserFlags: string[]; // Current user's flags (e.g., +r for registered)
  isAutoAway: boolean; // Whether the away status was set automatically due to inactivity
  watchLimit: number; // WATCH limit from 005, 0 if not supported
  monitorLimit: number; // MONITOR limit from 005, 0 if not supported
  silenceLimit: number; // SILENCE limit from 005, 0 if not supported
  currentUserAvatar: string | undefined; // Current user's avatar URL from metadata
  fontFormatting: FontFormatting; // Current font formatting settings for outgoing messages
  isDarkMode: boolean; // Whether dark mode is enabled
  hideAvatarsInUsersList: boolean; // Whether to hide avatars in the users list
  fontSize: FontSize; // Font size for chat, users list, and channels list

  setWizardCompleted: (status: boolean) => void;
  setIsConnecting: (status: boolean) => void;
  setIsConnected: (status: boolean) => void;
  setConnectedTime: (time: number) => void;
  setNick: (newNick: string) => void;
  setServer: (newServer: Server) => void;
  setWizardStep: (newWizardStep: WizardStep) => void;
  setIsPasswordRequired: (status: boolean) => void;
  setCurrentChannelName: (channelName: string, category: ChannelCategory) => void;
  setTheme: (theme: 'modern' | 'classic') => void;
  setUserModes: (modes: UserMode[]) => void;
  setChannelModes: (modes: ChannelMode) => void;
  setListRequestRemainingSeconds: (seconds: number) => void;
  setChannelTypes: (types: string[]) => void;
  setSupportedOption: (option: string) => void;
  setWizardProgress: (value: number, label: string) => void;
  setCurrentUserFlag: (flag: string, add: boolean) => void;
  setIsAutoAway: (isAuto: boolean) => void;
  setWatchLimit: (limit: number) => void;
  setMonitorLimit: (limit: number) => void;
  setSilenceLimit: (limit: number) => void;
  setCurrentUserAvatar: (avatar: string | undefined) => void;
  setFontFormatting: (formatting: Partial<FontFormatting>) => void;
  setIsDarkMode: (isDarkMode: boolean) => void;
  toggleDarkMode: () => void;
  setHideAvatarsInUsersList: (hide: boolean) => void;
  setFontSize: (fontSize: FontSize) => void;
  resetWizardState: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools((set) => ({
    isConnecting: false,
    isConnected: false,
    isWizardCompleted: false,
    wizardStep: 'init',
    nick: '',
    server: undefined,
    isPasswordRequired: undefined,
    connectedTime: 0,
    currentChannelName: 'Status',
    currentChannelCategory: ChannelCategory.status,
    theme: 'modern',
    userModes: [],
    channelModes: { A: [], B: [], C: [], D: [] },
    listRequestRemainingSeconds: -1,
    channelTypes: [],
    supportedOptions: [],
    wizardProgress: { value: 0, label: '' },
    currentUserFlags: [],
    isAutoAway: false,
    watchLimit: 0,
    monitorLimit: 0,
    silenceLimit: 0,
    currentUserAvatar: undefined,
    fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
    isDarkMode: false,
    hideAvatarsInUsersList: false,
    fontSize: 'medium',

    setWizardCompleted: (status: boolean): void => {
      set(() => ({
        isWizardCompleted: status,
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
    setWizardStep: (newWizardStep: WizardStep): void => {
      set(() => ({ wizardStep: newWizardStep }));
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
    setChannelModes: (modes: ChannelMode): void => {
      set(() => ({ channelModes: modes }));
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
    setWizardProgress: (value: number, label: string): void => {
      set(() => ({ wizardProgress: { value, label } }));
    },
    setCurrentUserFlag: (flag: string, add: boolean): void => {
      set((state) => ({
        currentUserFlags: add
          ? [...state.currentUserFlags, flag]
          : state.currentUserFlags.filter((f) => f !== flag),
      }));
    },
    setIsAutoAway: (isAuto: boolean): void => {
      set(() => ({ isAutoAway: isAuto }));
    },
    setWatchLimit: (limit: number): void => {
      set(() => ({ watchLimit: limit }));
    },
    setMonitorLimit: (limit: number): void => {
      set(() => ({ monitorLimit: limit }));
    },
    setSilenceLimit: (limit: number): void => {
      set(() => ({ silenceLimit: limit }));
    },
    setCurrentUserAvatar: (avatar: string | undefined): void => {
      set(() => ({ currentUserAvatar: avatar }));
    },
    setFontFormatting: (formatting: Partial<FontFormatting>): void => {
      set((state) => ({
        fontFormatting: { ...state.fontFormatting, ...formatting },
      }));
    },
    setIsDarkMode: (isDarkMode: boolean): void => {
      set(() => ({ isDarkMode }));
    },
    toggleDarkMode: (): void => {
      set((state) => ({ isDarkMode: !state.isDarkMode }));
    },
    setHideAvatarsInUsersList: (hide: boolean): void => {
      set(() => ({ hideAvatarsInUsersList: hide }));
    },
    setFontSize: (fontSize: FontSize): void => {
      set(() => ({ fontSize }));
    },
    resetWizardState: (): void => {
      set(() => ({
        isConnecting: false,
        isConnected: false,
        isWizardCompleted: false,
        wizardStep: 'init',
        nick: '',
        server: undefined,
        isPasswordRequired: undefined,
        connectedTime: 0,
        currentChannelName: 'Status',
        currentChannelCategory: ChannelCategory.status,
        userModes: [],
        channelModes: { A: [], B: [], C: [], D: [] },
        listRequestRemainingSeconds: -1,
        channelTypes: [],
        supportedOptions: [],
        wizardProgress: { value: 0, label: '' },
        currentUserFlags: [],
        isAutoAway: false,
        watchLimit: 0,
        monitorLimit: 0,
        silenceLimit: 0,
        currentUserAvatar: undefined,
        fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        isDarkMode: false,
        hideAvatarsInUsersList: false,
        fontSize: 'medium',
      }));
    },
  })),
);

export const setCurrentChannelName = (channelName: string, category: ChannelCategory): void => {
  useSettingsStore.getState().setCurrentChannelName(channelName, category);

  setClearUnreadMessages(channelName);

  useCurrentStore.getState().setUpdateTopic(getTopic(channelName));
  useCurrentStore.getState().setUpdateMessages(getMessages(channelName));
  useCurrentStore.getState().setUpdateUsers(getUsersFromChannelSortedByMode(channelName));
  useCurrentStore.getState().setUpdateTyping(getTyping(channelName));
};

export const setWizardCompleted = (status: boolean): void => {
  useSettingsStore.getState().setWizardCompleted(status);
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

export const setWizardStep = (newWizardStep: WizardStep): void => {
  useSettingsStore.getState().setWizardStep(newWizardStep);
};

export const setIsPasswordRequired = (status: boolean): void => {
  useSettingsStore.getState().setIsPasswordRequired(status);
};

export const setTheme = (newTheme: 'modern' | 'classic'): void => {
  useSettingsStore.getState().setTheme(newTheme);
};

export const setUserModes = (modes: UserMode[]): void => {
  useSettingsStore.getState().setUserModes(modes);
};

export const setChannelModes = (modes: ChannelMode): void => {
  useSettingsStore.getState().setChannelModes(modes);
};

export const getChannelModes = (): ChannelMode => {
  return useSettingsStore.getState().channelModes;
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

export const getServer = (): Server | undefined => {
  return useSettingsStore.getState().server;
};

export const getCurrentChannelName = (): string => {
  return useSettingsStore.getState().currentChannelName;
};

export const getCurrentChannelCategory = (): ChannelCategory => {
  return useSettingsStore.getState().currentChannelCategory;
};

export const getChannelTypes = (): string[] => {
  return useSettingsStore.getState().channelTypes ?? defaultChannelTypes;
};

export const getUserModes = (): UserMode[] => {
  return useSettingsStore.getState().userModes;
};

export const getConnectedTime = (): number => {
  return useSettingsStore.getState().connectedTime;
};

export const getIsWizardCompleted = (): boolean => {
  return useSettingsStore.getState().isWizardCompleted;
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

export const setWizardProgress = (value: number, label: string): void => {
  useSettingsStore.getState().setWizardProgress(value, label);
};

export const getWizardProgress = (): WizardProgress => {
  return useSettingsStore.getState().wizardProgress;
};

export const setCurrentUserFlag = (flag: string, add: boolean): void => {
  useSettingsStore.getState().setCurrentUserFlag(flag, add);
};

export const getCurrentUserFlags = (): string[] => {
  return useSettingsStore.getState().currentUserFlags;
};

export const setWatchLimit = (limit: number): void => {
  useSettingsStore.getState().setWatchLimit(limit);
};

export const setMonitorLimit = (limit: number): void => {
  useSettingsStore.getState().setMonitorLimit(limit);
};

export const getWatchLimit = (): number => {
  return useSettingsStore.getState().watchLimit;
};

export const getMonitorLimit = (): number => {
  return useSettingsStore.getState().monitorLimit;
};

export const setSilenceLimit = (limit: number): void => {
  useSettingsStore.getState().setSilenceLimit(limit);
};

export const getSilenceLimit = (): number => {
  return useSettingsStore.getState().silenceLimit;
};

export const setCurrentUserAvatar = (avatar: string | undefined): void => {
  useSettingsStore.getState().setCurrentUserAvatar(avatar);
};

export const setFontFormatting = (formatting: Partial<FontFormatting>): void => {
  useSettingsStore.getState().setFontFormatting(formatting);
};

export const getFontFormatting = (): FontFormatting => {
  return useSettingsStore.getState().fontFormatting;
};

export const resetWizardState = (): void => {
  useSettingsStore.getState().resetWizardState();
};

export const setIsDarkMode = (isDarkMode: boolean): void => {
  useSettingsStore.getState().setIsDarkMode(isDarkMode);
};

export const toggleDarkMode = (): void => {
  useSettingsStore.getState().toggleDarkMode();
};

export const getIsDarkMode = (): boolean => {
  return useSettingsStore.getState().isDarkMode;
};

export const setHideAvatarsInUsersList = (hide: boolean): void => {
  useSettingsStore.getState().setHideAvatarsInUsersList(hide);
};

export const getHideAvatarsInUsersList = (): boolean => {
  return useSettingsStore.getState().hideAvatarsInUsersList;
};

export const setFontSize = (fontSize: FontSize): void => {
  useSettingsStore.getState().setFontSize(fontSize);
};

export const getFontSize = (): FontSize => {
  return useSettingsStore.getState().fontSize;
};

export const resetAndGoToStart = (): void => {
  // Disconnect from the network
  ircDisconnect();

  // Clear all stores
  setChannelsClearAll();
  setUsersClearAll();
  setCurrentClearAll();
  setChannelListClear();

  // Reset settings store to initial state (this also sets wizardStep to 'nick')
  resetWizardState();
};
