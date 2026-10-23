import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type Message } from '@shared/types';

/** The message each window's next message answers, as its draft is kept per window */
interface ReplyToStore {
  replies: Record<string, Message>;
}

export const useReplyToStore = create<ReplyToStore>()(devtools(() => ({ replies: {} })));

export const setReplyTo = (window: string, message: Message): void => {
  useReplyToStore.setState((state) => ({ replies: { ...state.replies, [window]: message } }));
};

export const getReplyTo = (window: string): Message | undefined => useReplyToStore.getState().replies[window];

export const clearReplyTo = (window: string): void => {
  useReplyToStore.setState((state) => ({ replies: Object.fromEntries(Object.entries(state.replies).filter(([key]) => key !== window)) }));
};

export const clearAllReplies = (): void => {
  useReplyToStore.setState({ replies: {} });
};
