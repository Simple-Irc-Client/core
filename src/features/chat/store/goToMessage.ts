import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { setCurrentChannelName } from '@features/settings/store/settings';
import { type ChannelCategory } from '@shared/types';

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
