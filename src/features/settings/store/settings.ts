import { create } from 'zustand';
import { type Server } from '@/network/irc/servers';
import { devtools, persist } from 'zustand/middleware';
import { ChannelCategory, type ChannelMode, type UserMode } from '@shared/types';
import { getMessages, getTopic, getTyping, setClearUnreadMessages, setChannelsClearAll } from '@features/channels/store/channels';
import { useCurrentStore, setCurrentClearAll } from '@features/chat/store/current';
import { getUsersFromChannelSortedByMode, setUsersClearAll } from '@features/users/store/users';
import { defaultChannelTypes } from '@/config/config';
import { type LanguageSetting } from '@/config/languages';
import { setChannelListClear } from '@features/channels/store/channelList';
import { ircDisconnect } from '@/network/irc/network';

export type WizardStep = 'nick' | 'server' | 'loading' | 'password' | 'channels';

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
  nickLenLimit: number; // NICKLEN from 005, default 50
  currentUserAvatar: string | undefined; // Current user's avatar URL from metadata
  currentUserDisplayName: string | undefined; // Current user's display name from metadata
  currentUserStatus: string | undefined; // Current user's status text from metadata
  currentUserHomepage: string | undefined; // Current user's homepage URL from metadata
  currentUserColor: string | undefined; // Current user's nick color from metadata
  fontFormatting: FontFormatting; // Current font formatting settings for outgoing messages
  isDarkMode: boolean; // Whether dark mode is enabled
  hideAvatarsInUsersList: boolean; // Whether to hide avatars in the users list
  hideTypingIndicator: boolean; // Whether to hide the typing indicator
  fontSize: FontSize; // Font size for chat, users list, and channels list
  language: LanguageSetting; // Language preference ('auto' = browser detection)

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
  setNickLenLimit: (limit: number) => void;
  setCurrentUserAvatar: (avatar: string | undefined) => void;
  setCurrentUserDisplayName: (displayName: string | undefined) => void;
  setCurrentUserStatus: (status: string | undefined) => void;
  setCurrentUserHomepage: (homepage: string | undefined) => void;
  setCurrentUserColor: (color: string | undefined) => void;
  setFontFormatting: (formatting: Partial<FontFormatting>) => void;
  setIsDarkMode: (isDarkMode: boolean) => void;
  toggleDarkMode: () => void;
  setHideAvatarsInUsersList: (hide: boolean) => void;
  setHideTypingIndicator: (hide: boolean) => void;
  setFontSize: (fontSize: FontSize) => void;
  setLanguage: (language: LanguageSetting) => void;
  resetWizardState: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist((set) => ({
    isConnecting: false,
    isConnected: false,
    isWizardCompleted: false,
    wizardStep: 'nick',
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
    nickLenLimit: 50,
    currentUserAvatar: undefined,
    currentUserDisplayName: undefined,
    currentUserStatus: undefined,
    currentUserHomepage: undefined,
    currentUserColor: undefined,
    fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
    isDarkMode: false,
    hideAvatarsInUsersList: false,
    hideTypingIndicator: false,
    fontSize: 'medium',
    language: 'auto',

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
    setNickLenLimit: (limit: number): void => {
      set(() => ({ nickLenLimit: limit }));
    },
    setCurrentUserAvatar: (avatar: string | undefined): void => {
      set(() => ({ currentUserAvatar: avatar }));
    },
    setCurrentUserDisplayName: (displayName: string | undefined): void => {
      set(() => ({ currentUserDisplayName: displayName }));
    },
    setCurrentUserStatus: (status: string | undefined): void => {
      set(() => ({ currentUserStatus: status }));
    },
    setCurrentUserHomepage: (homepage: string | undefined): void => {
      set(() => ({ currentUserHomepage: homepage }));
    },
    setCurrentUserColor: (color: string | undefined): void => {
      set(() => ({ currentUserColor: color }));
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
    setHideTypingIndicator: (hide: boolean): void => {
      set(() => ({ hideTypingIndicator: hide }));
    },
    setFontSize: (fontSize: FontSize): void => {
      set(() => ({ fontSize }));
    },
    setLanguage: (language: LanguageSetting): void => {
      set(() => ({ language }));
    },
    resetWizardState: (): void => {
      set(() => ({
        isConnecting: false,
        isConnected: false,
        isWizardCompleted: false,
        wizardStep: 'nick',
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
        nickLenLimit: 50,
        currentUserAvatar: undefined,
        currentUserDisplayName: undefined,
        currentUserStatus: undefined,
        currentUserHomepage: undefined,
        currentUserColor: undefined,
      }));
    },
  }),
  {
    name: 'sic-settings',
    version: 1,
    partialize: (state) => ({
      isDarkMode: state.isDarkMode,
      theme: state.theme,
      fontSize: state.fontSize,
      hideAvatarsInUsersList: state.hideAvatarsInUsersList,
      hideTypingIndicator: state.hideTypingIndicator,
      fontFormatting: state.fontFormatting,
      nick: state.nick,
      server: state.server,
      language: state.language,
    }),
  }),
  ),
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

export const setNickLenLimit = (limit: number): void => {
  useSettingsStore.getState().setNickLenLimit(limit);
};

export const getNickLenLimit = (): number => {
  return useSettingsStore.getState().nickLenLimit;
};

export const setCurrentUserAvatar = (avatar: string | undefined): void => {
  useSettingsStore.getState().setCurrentUserAvatar(avatar);
};

export const setCurrentUserDisplayName = (displayName: string | undefined): void => {
  useSettingsStore.getState().setCurrentUserDisplayName(displayName);
};

export const getCurrentUserDisplayName = (): string | undefined => {
  return useSettingsStore.getState().currentUserDisplayName;
};

export const setCurrentUserStatus = (status: string | undefined): void => {
  useSettingsStore.getState().setCurrentUserStatus(status);
};

export const getCurrentUserStatus = (): string | undefined => {
  return useSettingsStore.getState().currentUserStatus;
};

export const setCurrentUserHomepage = (homepage: string | undefined): void => {
  useSettingsStore.getState().setCurrentUserHomepage(homepage);
};

export const getCurrentUserHomepage = (): string | undefined => {
  return useSettingsStore.getState().currentUserHomepage;
};

export const setCurrentUserColor = (color: string | undefined): void => {
  useSettingsStore.getState().setCurrentUserColor(color);
};

export const getCurrentUserColor = (): string | undefined => {
  return useSettingsStore.getState().currentUserColor;
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

export const setHideTypingIndicator = (hide: boolean): void => {
  useSettingsStore.getState().setHideTypingIndicator(hide);
};

export const getHideTypingIndicator = (): boolean => {
  return useSettingsStore.getState().hideTypingIndicator;
};

export const setFontSize = (fontSize: FontSize): void => {
  useSettingsStore.getState().setFontSize(fontSize);
};

export const getFontSize = (): FontSize => {
  return useSettingsStore.getState().fontSize;
};

export const setLanguage = (language: LanguageSetting): void => {
  useSettingsStore.getState().setLanguage(language);
};

export const getLanguage = (): LanguageSetting => {
  return useSettingsStore.getState().language;
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
