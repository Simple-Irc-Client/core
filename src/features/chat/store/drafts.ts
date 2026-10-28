import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { activeSlice, updateActiveSlice, type NetworkSlices } from '@features/networks/store/networkSlices';

interface DraftsSlice {
  drafts: Record<string, string>;
}

const NO_DRAFTS: DraftsSlice = { drafts: {} };

interface DraftsStore extends NetworkSlices<DraftsSlice> {
  setDraft: (channelName: string, message: string) => void;
  clearDraft: (channelName: string) => void;
  clearAll: () => void;
}

export const useDraftsStore = create<DraftsStore>()(
  devtools((set) => ({
    byNetwork: {},
    emptySlice: NO_DRAFTS,

    setDraft: (channelName: string, message: string): void => {
      set((state) => updateActiveSlice(state, (slice) => ({
        drafts: {
          ...slice.drafts,
          [channelName]: message,
        },
      })));
    },

    clearDraft: (channelName: string): void => {
      set((state) => updateActiveSlice(state, (slice) => ({
        drafts: Object.fromEntries(
          Object.entries(slice.drafts).filter(([key]) => key !== channelName)
        ),
      })));
    },

    clearAll: (): void => {
      set((state) => updateActiveSlice(state, () => ({ drafts: {} })));
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
  return activeSlice(useDraftsStore.getState()).drafts[channelName] ?? '';
};

export const clearDraft = (channelName: string): void => {
  useDraftsStore.getState().clearDraft(channelName);
};

export const clearAllDrafts = (): void => {
  useDraftsStore.getState().clearAll();
};
