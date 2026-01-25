import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface DraftsStore {
  drafts: Record<string, string>;
  setDraft: (channelName: string, message: string) => void;
  getDraft: (channelName: string) => string;
  clearDraft: (channelName: string) => void;
  clearAll: () => void;
}

export const useDraftsStore = create<DraftsStore>()(
  devtools((set, get) => ({
    drafts: {},

    setDraft: (channelName: string, message: string): void => {
      set((state) => ({
        drafts: {
          ...state.drafts,
          [channelName]: message,
        },
      }));
    },

    getDraft: (channelName: string): string => {
      return get().drafts[channelName] ?? '';
    },

    clearDraft: (channelName: string): void => {
      set((state) => {
        const { [channelName]: _, ...rest } = state.drafts;
        return { drafts: rest };
      });
    },

    clearAll: (): void => {
      set(() => ({ drafts: {} }));
    },
  })),
);

export const setDraft = (channelName: string, message: string): void => {
  if (message.length > 0) {
    useDraftsStore.getState().setDraft(channelName, message);
  } else {
    useDraftsStore.getState().clearDraft(channelName);
  }
};

export const getDraft = (channelName: string): string => {
  return useDraftsStore.getState().getDraft(channelName);
};

export const clearDraft = (channelName: string): void => {
  useDraftsStore.getState().clearDraft(channelName);
};

export const clearAllDrafts = (): void => {
  useDraftsStore.getState().clearAll();
};
