import { create } from 'zustand';
import { type Message, type User } from '../types';
import { devtools } from 'zustand/middleware';

interface CurrentStore {
  topic: string;
  messages: Message[];
  users: User[];
  typing: string[];

  setUpdateTopic: (topic: string) => void;
  setUpdateMessages: (messages: Message[]) => void;
  setUpdateUsers: (users: User[]) => void;
  setUpdateTyping: (typing: string[]) => void;
  setClearAll: () => void;
}

export const useCurrentStore = create<CurrentStore>()(
  devtools((set) => ({
    topic: '',
    messages: [],
    users: [],
    typing: [],

    setUpdateTopic: (topic: string): void => {
      set(() => ({
        topic,
      }));
    },
    setUpdateMessages: (messages: Message[]): void => {
      set(() => ({
        messages,
      }));
    },
    setUpdateUsers: (users: User[]): void => {
      set(() => ({
        users,
      }));
    },
    setUpdateTyping: (typing: string[]): void => {
      set(() => ({
        typing,
      }));
    },
    setClearAll: (): void => {
      set(() => ({
        topic: '',
        messages: [],
        users: [],
        typing: [],
      }));
    },
  })),
);

export const setCurrentClearAll = (): void => {
  useCurrentStore.getState().setClearAll();
};
