import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Message } from '@shared/types';
import { activeSlice, updateActiveSlice, useActiveSlice, type NetworkSlices } from '@features/networks/store/networkSlices';

const MAX_AWAY_MESSAGES = 1_000;

export interface AwayMessage extends Message {
  channel: string;
}

interface AwayMessagesSlice {
  messages: AwayMessage[];
}

const NO_AWAY_MESSAGES: AwayMessagesSlice = { messages: [] };

export interface AwayMessagesStore extends NetworkSlices<AwayMessagesSlice> {
  addAwayMessage: (message: AwayMessage) => void;
  clearAwayMessages: () => void;
}

export const useAwayMessagesStore = create<AwayMessagesStore>()(
  devtools((set) => ({
    byNetwork: {},
    emptySlice: NO_AWAY_MESSAGES,
    addAwayMessage: (message: AwayMessage): void => {
      set((state) => updateActiveSlice(state, (slice) => {
        if (slice.messages.length >= MAX_AWAY_MESSAGES) { return slice; }
        return { messages: [...slice.messages, message] };
      }));
    },
    clearAwayMessages: (): void => {
      set((state) => updateActiveSlice(state, () => ({ messages: [] })));
    },
  })),
);

/** The active network's away messages */
export const useActiveAwayMessages = <T>(selector: (slice: AwayMessagesSlice) => T): T => useActiveSlice(useAwayMessagesStore, selector);

export const addAwayMessage = (message: AwayMessage): void => {
  useAwayMessagesStore.getState().addAwayMessage(message);
};

export const clearAwayMessages = (): void => {
  useAwayMessagesStore.getState().clearAwayMessages();
};

export const getAwayMessages = (): AwayMessage[] => {
  return activeSlice(useAwayMessagesStore.getState()).messages;
};

export const getAwayMessagesCount = (): number => {
  return getAwayMessages().length;
};
