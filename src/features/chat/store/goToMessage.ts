import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type ChannelCategory } from '@shared/types';
import { setCurrentChannelName } from '@features/networks/currentChannel';

/** A message to scroll to once its window shows */
interface GoToMessageStore {
  sought: { channelName: string; messageId: string } | undefined;
}

export const useGoToMessageStore = create<GoToMessageStore>()(devtools(() => ({ sought: undefined })));

export const goToMessage = (channelName: string, category: ChannelCategory, messageId: string): void => {
  setCurrentChannelName(channelName, category);
  useGoToMessageStore.setState({ sought: { channelName, messageId } });
};

export const clearGoToMessage = (): void => {
  useGoToMessageStore.setState({ sought: undefined });
};
