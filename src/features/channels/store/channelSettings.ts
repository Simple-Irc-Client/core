import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ListEntry {
  mask: string;
  setBy: string;
  setTime: number;
}

export type ActiveTab = 'modes' | 'lists' | 'users';
export type ActiveListType = 'b' | 'e' | 'I';

export interface ChannelSettingsStore {
  // Dialog state
  isLoading: boolean;
  activeTab: ActiveTab;
  activeListType: ActiveListType;

  // Channel data
  channelName: string;
  channelModes: Record<string, string | boolean>; // e.g., {n: true, t: true, l: '50', k: 'secret'}

  // List data (Type A modes)
  banList: ListEntry[];
  exceptionList: ListEntry[];
  inviteList: ListEntry[];

  // Loading states for lists
  isBanListLoading: boolean;
  isExceptionListLoading: boolean;
  isInviteListLoading: boolean;

  // Actions
  setIsLoading: (loading: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setActiveListType: (type: ActiveListType) => void;
  setChannelName: (name: string) => void;
  setChannelModes: (modes: Record<string, string | boolean>) => void;
  updateChannelMode: (mode: string, value: string | boolean | null) => void;
  setBanList: (list: ListEntry[]) => void;
  setExceptionList: (list: ListEntry[]) => void;
  setInviteList: (list: ListEntry[]) => void;
  addToBanList: (entry: ListEntry) => void;
  addToExceptionList: (entry: ListEntry) => void;
  addToInviteList: (entry: ListEntry) => void;
  removeFromBanList: (mask: string) => void;
  removeFromExceptionList: (mask: string) => void;
  removeFromInviteList: (mask: string) => void;
  setIsBanListLoading: (loading: boolean) => void;
  setIsExceptionListLoading: (loading: boolean) => void;
  setIsInviteListLoading: (loading: boolean) => void;
  clearStore: () => void;
}

const initialState = {
  isLoading: false,
  activeTab: 'modes' as ActiveTab,
  activeListType: 'b' as ActiveListType,
  channelName: '',
  channelModes: {} as Record<string, string | boolean>,
  banList: [] as ListEntry[],
  exceptionList: [] as ListEntry[],
  inviteList: [] as ListEntry[],
  isBanListLoading: false,
  isExceptionListLoading: false,
  isInviteListLoading: false,
};

export const useChannelSettingsStore = create<ChannelSettingsStore>()(
  devtools((set) => ({
    ...initialState,

    setIsLoading: (loading: boolean): void => {
      set(() => ({ isLoading: loading }));
    },

    setActiveTab: (tab: ActiveTab): void => {
      set(() => ({ activeTab: tab }));
    },

    setActiveListType: (type: ActiveListType): void => {
      set(() => ({ activeListType: type }));
    },

    setChannelName: (name: string): void => {
      set(() => ({ channelName: name }));
    },

    setChannelModes: (modes: Record<string, string | boolean>): void => {
      set(() => ({ channelModes: modes }));
    },

    updateChannelMode: (mode: string, value: string | boolean | null): void => {
      set((state) => {
        if (value === null || value === false) {
          const { [mode]: _removed, ...rest } = state.channelModes;
          void _removed; // Intentionally unused - removing mode from object
          return { channelModes: rest };
        }
        return { channelModes: { ...state.channelModes, [mode]: value } };
      });
    },

    setBanList: (list: ListEntry[]): void => {
      set(() => ({ banList: list }));
    },

    setExceptionList: (list: ListEntry[]): void => {
      set(() => ({ exceptionList: list }));
    },

    setInviteList: (list: ListEntry[]): void => {
      set(() => ({ inviteList: list }));
    },

    addToBanList: (entry: ListEntry): void => {
      set((state) => ({ banList: [...state.banList, entry] }));
    },

    addToExceptionList: (entry: ListEntry): void => {
      set((state) => ({ exceptionList: [...state.exceptionList, entry] }));
    },

    addToInviteList: (entry: ListEntry): void => {
      set((state) => ({ inviteList: [...state.inviteList, entry] }));
    },

    removeFromBanList: (mask: string): void => {
      set((state) => ({ banList: state.banList.filter((e) => e.mask !== mask) }));
    },

    removeFromExceptionList: (mask: string): void => {
      set((state) => ({ exceptionList: state.exceptionList.filter((e) => e.mask !== mask) }));
    },

    removeFromInviteList: (mask: string): void => {
      set((state) => ({ inviteList: state.inviteList.filter((e) => e.mask !== mask) }));
    },

    setIsBanListLoading: (loading: boolean): void => {
      set(() => ({ isBanListLoading: loading }));
    },

    setIsExceptionListLoading: (loading: boolean): void => {
      set(() => ({ isExceptionListLoading: loading }));
    },

    setIsInviteListLoading: (loading: boolean): void => {
      set(() => ({ isInviteListLoading: loading }));
    },

    clearStore: (): void => {
      set(() => ({ ...initialState }));
    },
  })),
);

// Helper functions for external access
export const setChannelSettingsChannelName = (name: string): void => {
  useChannelSettingsStore.getState().setChannelName(name);
};

export const setChannelSettingsModes = (modes: Record<string, string | boolean>): void => {
  useChannelSettingsStore.getState().setChannelModes(modes);
};

export const updateChannelSettingsMode = (mode: string, value: string | boolean | null): void => {
  useChannelSettingsStore.getState().updateChannelMode(mode, value);
};

export const getChannelSettingsModes = (): Record<string, string | boolean> => {
  return useChannelSettingsStore.getState().channelModes;
};

export const addToChannelSettingsBanList = (entry: ListEntry): void => {
  useChannelSettingsStore.getState().addToBanList(entry);
};

export const addToChannelSettingsExceptionList = (entry: ListEntry): void => {
  useChannelSettingsStore.getState().addToExceptionList(entry);
};

export const addToChannelSettingsInviteList = (entry: ListEntry): void => {
  useChannelSettingsStore.getState().addToInviteList(entry);
};

export const setChannelSettingsBanList = (list: ListEntry[]): void => {
  useChannelSettingsStore.getState().setBanList(list);
};

export const setChannelSettingsExceptionList = (list: ListEntry[]): void => {
  useChannelSettingsStore.getState().setExceptionList(list);
};

export const setChannelSettingsInviteList = (list: ListEntry[]): void => {
  useChannelSettingsStore.getState().setInviteList(list);
};

export const setChannelSettingsIsLoading = (loading: boolean): void => {
  useChannelSettingsStore.getState().setIsLoading(loading);
};

export const setChannelSettingsIsBanListLoading = (loading: boolean): void => {
  useChannelSettingsStore.getState().setIsBanListLoading(loading);
};

export const setChannelSettingsIsExceptionListLoading = (loading: boolean): void => {
  useChannelSettingsStore.getState().setIsExceptionListLoading(loading);
};

export const setChannelSettingsIsInviteListLoading = (loading: boolean): void => {
  useChannelSettingsStore.getState().setIsInviteListLoading(loading);
};

export const clearChannelSettingsStore = (): void => {
  useChannelSettingsStore.getState().clearStore();
};
