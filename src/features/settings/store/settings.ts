import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { BUILTIN_THEMES, DEFAULT_THEME_ID, isBuiltinTheme, type BuiltinThemeId } from '@features/themes/builtinThemes';
import { type CustomTheme } from '@features/themes/themeSelectors';
import { devtools, persist } from 'zustand/middleware';
import { type LanguageSetting } from '@/config/languages';
import { type NotificationSound } from '@features/sounds/sounds';
import { type MembershipEventsDisplay } from '@features/chat/membershipEvents';
import { type NetworkId } from '@features/networks/networkId';
import { getActiveNetworkId, NO_NETWORK } from '@features/networks/store/networks';
import { moveLegacyBouncerIdentity, rekeyLegacyNetworks, saveLegacyNetworks, SETTINGS_VERSION_WITHOUT_SESSION } from '@features/networks/legacyStorage';
import { E2EE_IDENTITY_KEY_PREFIX } from '@features/e2ee/identity';

export type WizardStep = 'nick' | 'server' | 'bouncer' | 'loading' | 'networks' | 'password' | 'channels';

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

export type TimeFormat = '24h' | '12h';

/** How the user wants times shown */
export interface TimeSettings {
  timeFormat: TimeFormat;
  showSeconds: boolean;
}

/** How tightly the chat lays out its messages */
export type Density = 'comfortable' | 'compact';

/** The choices of how long without a sent message sets the user away; 0 never does */
export const AUTO_AWAY_MINUTES = [0, 5, 15, 30, 60] as const;
export type AutoAwayMinutes = (typeof AUTO_AWAY_MINUTES)[number];

export const fontSizeClasses: Record<FontSize, string> = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base',
};

export interface SettingsStore {
  isWizardCompleted: boolean;
  wizardStep: WizardStep;
  /** The nick typed in the wizard; a network's own nick may differ once its server renames it */
  wizardNick: string;
  isPasswordRequired: boolean | undefined;
  theme: string; // active theme id: a builtin id ('modern' | 'classic') or a custom theme uuid
  customThemes: Record<string, CustomTheme>;
  builtinThemeOverrides: Partial<Record<BuiltinThemeId, string>>; // user-edited CSS of builtin themes; absent key = shipped default
  wizardProgress: WizardProgress;
  fontFormatting: FontFormatting; // Current font formatting settings for outgoing messages
  isDarkMode: boolean; // Whether dark mode is enabled
  hideAvatarsInUsersList: boolean; // Whether to hide avatars in the users list
  hideTypingIndicator: boolean; // Whether to hide the typing indicator
  autoOfferEncryption: boolean; // Whether to offer end-to-end encryption automatically in private messages
  e2eeEnabled: boolean; // Whether end-to-end encryption is available at all; off suppresses offers and auto-declines incoming ones
  fontSize: FontSize; // Font size for chat, users list, and channels list
  language: LanguageSetting; // Language preference ('auto' = browser detection)
  serverPasswords: Record<NetworkId, { encrypted: string; nick: string }>; // Encrypted NickServ passwords per network (persistent)
  isWizardHintDismissed: boolean; // Whether the wizard intro hint has been permanently dismissed
  highlightWords: string[]; // Words that highlight a message besides the own nick
  directSound: NotificationSound; // Sound for a private message
  mentionSound: NotificationSound; // Sound for a mention in a channel
  soundVolume: number; // Notification sound volume, 0–100
  membershipEvents: MembershipEventsDisplay; // How join/part/quit/nick lines are shown
  timeFormat: TimeFormat;
  showSeconds: boolean; // Message times show seconds in every theme
  density: Density;
  showLag: boolean; // The lag next to the network name
  autoAwayMinutes: AutoAwayMinutes;
  autoAwayMessage: string; // The away message auto-away sets; empty for the default one

  setWizardCompleted: (status: boolean) => void;
  setWizardStep: (newWizardStep: WizardStep) => void;
  setWizardNick: (nick: string) => void;
  setIsPasswordRequired: (status: boolean) => void;
  setTheme: (theme: string) => void;
  addCustomTheme: (name: string, css: string) => string;
  updateCustomTheme: (id: string, patch: Partial<CustomTheme>) => void;
  deleteCustomTheme: (id: string) => void;
  setBuiltinThemeCss: (id: BuiltinThemeId, css: string) => void;
  resetBuiltinThemeCss: (id: BuiltinThemeId) => void;
  setWizardProgress: (value: number, label: string) => void;
  setFontFormatting: (formatting: Partial<FontFormatting>) => void;
  toggleDarkMode: () => void;
  setHideAvatarsInUsersList: (hide: boolean) => void;
  setHideTypingIndicator: (hide: boolean) => void;
  setAutoOfferEncryption: (autoOffer: boolean) => void;
  setE2eeEnabled: (enabled: boolean) => void;
  setFontSize: (fontSize: FontSize) => void;
  setLanguage: (language: LanguageSetting) => void;
  setEncryptedPassword: (networkId: NetworkId, encrypted: string | undefined, nick: string | undefined) => void;
  setWizardHintDismissed: () => void;
  setHighlightWords: (words: string[]) => void;
  setDirectSound: (sound: NotificationSound) => void;
  setMentionSound: (sound: NotificationSound) => void;
  setSoundVolume: (volume: number) => void;
  setMembershipEvents: (display: MembershipEventsDisplay) => void;
  setTimeFormat: (timeFormat: TimeFormat) => void;
  setShowSeconds: (showSeconds: boolean) => void;
  setDensity: (density: Density) => void;
  setShowLag: (showLag: boolean) => void;
  setAutoAwayMinutes: (minutes: AutoAwayMinutes) => void;
  setAutoAwayMessage: (message: string) => void;
  resetWizardState: () => void;
}

/** The wizard's state: the initial values, and what resetWizardState restores */
const wizardDefaults = () => ({
  isWizardCompleted: false,
  wizardStep: 'nick',
  isPasswordRequired: undefined,
  wizardProgress: { value: 0, label: '' },
}) satisfies Partial<SettingsStore>;

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist((set) => ({
    ...wizardDefaults(),
    wizardNick: '',
    theme: DEFAULT_THEME_ID,
    customThemes: {},
    builtinThemeOverrides: {},
    fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
    isDarkMode: false,
    hideAvatarsInUsersList: false,
    hideTypingIndicator: false,
    autoOfferEncryption: false,
    e2eeEnabled: true,
    fontSize: 'medium',
    language: 'auto',
    serverPasswords: {},
    isWizardHintDismissed: false,
    highlightWords: [],
    directSound: 'chime',
    mentionSound: 'ping',
    soundVolume: 60,
    membershipEvents: 'collapse',
    timeFormat: '24h',
    showSeconds: false,
    density: 'comfortable',
    showLag: true,
    autoAwayMinutes: 15,
    autoAwayMessage: '',

    setWizardCompleted: (status: boolean): void => {
      set(() => ({
        isWizardCompleted: status,
      }));
    },
    setWizardStep: (newWizardStep: WizardStep): void => {
      set(() => ({ wizardStep: newWizardStep }));
    },
    setIsPasswordRequired: (status: boolean): void => {
      set(() => ({ isPasswordRequired: status }));
    },
    setTheme: (newTheme: string): void => {
      set(() => ({ theme: newTheme }));
    },
    addCustomTheme: (name: string, css: string): string => {
      const id = uuidv4();
      set((state) => ({ customThemes: { ...state.customThemes, [id]: { name, css } } }));
      return id;
    },
    updateCustomTheme: (id: string, patch: Partial<CustomTheme>): void => {
      set((state) => {
        const existing = state.customThemes[id];
        if (!existing) { return state; }
        return { customThemes: { ...state.customThemes, [id]: { ...existing, ...patch } } };
      });
    },
    deleteCustomTheme: (id: string): void => {
      set((state) => ({
        customThemes: Object.fromEntries(Object.entries(state.customThemes).filter(([key]) => key !== id)),
        ...(state.theme === id ? { theme: DEFAULT_THEME_ID } : {}),
      }));
    },
    setBuiltinThemeCss: (id: BuiltinThemeId, css: string): void => {
      set((state) => {
        // Storing the shipped default would freeze the theme at this version
        if (css === BUILTIN_THEMES[id].css) {
          return { builtinThemeOverrides: Object.fromEntries(Object.entries(state.builtinThemeOverrides).filter(([key]) => key !== id)) };
        }
        return { builtinThemeOverrides: { ...state.builtinThemeOverrides, [id]: css } };
      });
    },
    resetBuiltinThemeCss: (id: BuiltinThemeId): void => {
      set((state) => ({
        builtinThemeOverrides: Object.fromEntries(Object.entries(state.builtinThemeOverrides).filter(([key]) => key !== id)),
      }));
    },
    setWizardProgress: (value: number, label: string): void => {
      set(() => ({ wizardProgress: { value, label } }));
    },
    setFontFormatting: (formatting: Partial<FontFormatting>): void => {
      set((state) => ({
        fontFormatting: { ...state.fontFormatting, ...formatting },
      }));
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
    setAutoOfferEncryption: (autoOffer: boolean): void => {
      set(() => ({ autoOfferEncryption: autoOffer }));
    },
    setE2eeEnabled: (enabled: boolean): void => {
      set(() => ({ e2eeEnabled: enabled }));
    },
    setFontSize: (fontSize: FontSize): void => {
      set(() => ({ fontSize }));
    },
    setLanguage: (language: LanguageSetting): void => {
      set(() => ({ language }));
    },
    setEncryptedPassword: (networkId: NetworkId, encrypted: string | undefined, nick: string | undefined): void => {
      set((state) => {
        if (encrypted && nick) {
          return { serverPasswords: { ...state.serverPasswords, [networkId]: { encrypted, nick } } };
        }
        return { serverPasswords: Object.fromEntries(Object.entries(state.serverPasswords).filter(([key]) => key !== networkId)) };
      });
    },
    setWizardHintDismissed: (): void => {
      set(() => ({ isWizardHintDismissed: true }));
    },
    setHighlightWords: (words: string[]): void => {
      set(() => ({ highlightWords: words }));
    },
    setDirectSound: (sound: NotificationSound): void => {
      set(() => ({ directSound: sound }));
    },
    setMentionSound: (sound: NotificationSound): void => {
      set(() => ({ mentionSound: sound }));
    },
    setSoundVolume: (volume: number): void => {
      set(() => ({ soundVolume: volume }));
    },
    setMembershipEvents: (display: MembershipEventsDisplay): void => {
      set(() => ({ membershipEvents: display }));
    },
    setTimeFormat: (timeFormat: TimeFormat): void => {
      set(() => ({ timeFormat }));
    },
    setShowSeconds: (showSeconds: boolean): void => {
      set(() => ({ showSeconds }));
    },
    setDensity: (density: Density): void => {
      set(() => ({ density }));
    },
    setShowLag: (showLag: boolean): void => {
      set(() => ({ showLag }));
    },
    setAutoAwayMinutes: (minutes: AutoAwayMinutes): void => {
      set(() => ({ autoAwayMinutes: minutes }));
    },
    setAutoAwayMessage: (message: string): void => {
      set(() => ({ autoAwayMessage: message }));
    },
    setWizardNick: (nick: string): void => {
      set(() => ({ wizardNick: nick }));
    },
    resetWizardState: (): void => {
      set(wizardDefaults());
    },
  }),
  {
    name: 'sic-settings',
    version: SETTINGS_VERSION_WITHOUT_SESSION,
    migrate: (persisted, version) => {
      const state = persisted as Record<string, unknown>;
      if (version < 2) {
        delete state.savedChannels;
      }
      if (version < 3) {
        // Migrate flat encryptedPassword/passwordNick to per-server serverPasswords
        const encrypted = state.encryptedPassword as string | undefined;
        const nick = state.passwordNick as string | undefined;
        const network = (state.server as { network?: string } | undefined)?.network;
        if (encrypted && nick && network) {
          state.serverPasswords = { [network]: { encrypted, nick } };
        } else {
          state.serverPasswords = {};
        }
        delete state.encryptedPassword;
        delete state.passwordNick;
      }
      if (version < 4) {
        if (typeof state.theme !== 'string' || !isBuiltinTheme(state.theme)) {
          state.theme = DEFAULT_THEME_ID;
        }
        state.customThemes = {};
        state.builtinThemeOverrides = {};
      }
      if (version < SETTINGS_VERSION_WITHOUT_SESSION) {
        // The session moves to the networks store, and what was kept per network name under its NetworkId
        saveLegacyNetworks();
        state.wizardNick = typeof state.nick === 'string' ? state.nick : '';
        state.serverPasswords = rekeyLegacyNetworks((state.serverPasswords ?? {}) as Record<NetworkId, unknown>);
        void moveLegacyBouncerIdentity(E2EE_IDENTITY_KEY_PREFIX);
        delete state.nick;
        delete state.wantedNick;
        delete state.server;
        delete state.currentChannelName;
        delete state.currentChannelCategory;
      }
      return persisted as SettingsStore;
    },
    partialize: (state) => ({
      isDarkMode: state.isDarkMode,
      theme: state.theme,
      customThemes: state.customThemes,
      builtinThemeOverrides: state.builtinThemeOverrides,
      fontSize: state.fontSize,
      hideAvatarsInUsersList: state.hideAvatarsInUsersList,
      hideTypingIndicator: state.hideTypingIndicator,
      autoOfferEncryption: state.autoOfferEncryption,
      e2eeEnabled: state.e2eeEnabled,
      fontFormatting: state.fontFormatting,
      wizardNick: state.wizardNick,
      language: state.language,
      highlightWords: state.highlightWords,
      directSound: state.directSound,
      mentionSound: state.mentionSound,
      soundVolume: state.soundVolume,
      membershipEvents: state.membershipEvents,
      timeFormat: state.timeFormat,
      showSeconds: state.showSeconds,
      density: state.density,
      showLag: state.showLag,
      autoAwayMinutes: state.autoAwayMinutes,
      autoAwayMessage: state.autoAwayMessage,
      isWizardCompleted: state.isWizardCompleted,
      serverPasswords: state.serverPasswords,
    }),
  }),
  ),
);

export const setWizardCompleted = (status: boolean): void => {
  useSettingsStore.getState().setWizardCompleted(status);
};

export const setWizardStep = (newWizardStep: WizardStep): void => {
  useSettingsStore.getState().setWizardStep(newWizardStep);
};

export const getWizardNick = (): string => {
  return useSettingsStore.getState().wizardNick;
};

export const setWizardNick = (nick: string): void => {
  useSettingsStore.getState().setWizardNick(nick);
};

export const setIsPasswordRequired = (status: boolean): void => {
  useSettingsStore.getState().setIsPasswordRequired(status);
};

export const setTheme = (newTheme: string): void => {
  useSettingsStore.getState().setTheme(newTheme);
};

export const getIsWizardCompleted = (): boolean => {
  return useSettingsStore.getState().isWizardCompleted;
};

export const getIsPasswordRequired = (): boolean | undefined => {
  return useSettingsStore.getState().isPasswordRequired;
};

export const setWizardProgress = (value: number, label: string): void => {
  useSettingsStore.getState().setWizardProgress(value, label);
};

export const getWizardProgress = (): WizardProgress => {
  return useSettingsStore.getState().wizardProgress;
};

export const setFontFormatting = (formatting: Partial<FontFormatting>): void => {
  useSettingsStore.getState().setFontFormatting(formatting);
};

export const resetWizardState = (): void => {
  useSettingsStore.getState().resetWizardState();
};

/** For the active network; before one is chosen there is nothing to save it for */
export const setEncryptedPassword = (encrypted: string | undefined, nick: string | undefined): void => {
  const networkId = getActiveNetworkId();
  if (networkId !== NO_NETWORK) {
    useSettingsStore.getState().setEncryptedPassword(networkId, encrypted, nick);
  }
};

export const getEncryptedPassword = (): string | undefined => useSettingsStore.getState().serverPasswords[getActiveNetworkId()]?.encrypted;

export const getPasswordNick = (): string | undefined => useSettingsStore.getState().serverPasswords[getActiveNetworkId()]?.nick;

export const toggleDarkMode = (): void => {
  useSettingsStore.getState().toggleDarkMode();
};

export const setHideAvatarsInUsersList = (hide: boolean): void => {
  useSettingsStore.getState().setHideAvatarsInUsersList(hide);
};

export const setHideTypingIndicator = (hide: boolean): void => {
  useSettingsStore.getState().setHideTypingIndicator(hide);
};

export const setAutoOfferEncryption = (autoOffer: boolean): void => {
  useSettingsStore.getState().setAutoOfferEncryption(autoOffer);
};

export const getAutoOfferEncryption = (): boolean => {
  return useSettingsStore.getState().autoOfferEncryption;
};

export const setE2eeEnabled = (enabled: boolean): void => {
  useSettingsStore.getState().setE2eeEnabled(enabled);
};

export const getE2eeEnabled = (): boolean => {
  return useSettingsStore.getState().e2eeEnabled;
};

export const setFontSize = (fontSize: FontSize): void => {
  useSettingsStore.getState().setFontSize(fontSize);
};

export const setLanguage = (language: LanguageSetting): void => {
  useSettingsStore.getState().setLanguage(language);
};

export const setWizardHintDismissed = (): void => {
  useSettingsStore.getState().setWizardHintDismissed();
};

export const getHighlightWords = (): string[] => {
  return useSettingsStore.getState().highlightWords;
};

export const getDirectSound = (): NotificationSound => {
  return useSettingsStore.getState().directSound;
};

export const getMentionSound = (): NotificationSound => {
  return useSettingsStore.getState().mentionSound;
};

export const getSoundVolume = (): number => {
  return useSettingsStore.getState().soundVolume;
};

export const getTimeSettings = (): TimeSettings => {
  const { timeFormat, showSeconds } = useSettingsStore.getState();
  return { timeFormat, showSeconds };
};
