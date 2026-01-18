import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Message } from '../types';

export interface AwayMessage extends Message {
  channel: string;
}

export interface AwayMessagesStore {
  messages: AwayMessage[];
  addAwayMessage: (message: AwayMessage) => void;
  clearAwayMessages: () => void;
}

export const useAwayMessagesStore = create<AwayMessagesStore>()(
  devtools((set) => ({
    messages: [],
    addAwayMessage: (message: AwayMessage): void => {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    },
    clearAwayMessages: (): void => {
      set(() => ({
        messages: [],
      }));
    },
  })),
);

export const addAwayMessage = (message: AwayMessage): void => {
  useAwayMessagesStore.getState().addAwayMessage(message);
};

export const clearAwayMessages = (): void => {
  useAwayMessagesStore.getState().clearAwayMessages();
};

export const getAwayMessages = (): AwayMessage[] => {
  return useAwayMessagesStore.getState().messages;
};

export const getAwayMessagesCount = (): number => {
  return useAwayMessagesStore.getState().messages.length;
};
