// Switching windows: the session remembers it, the window is shown and read

import { type ChannelCategory } from '@shared/types';
import { getMessages, getTopic, getTyping, setClearUnreadMessages } from '@features/channels/store/channels';
import { useCurrentStore } from '@features/chat/store/current';
import { flushCurrentUsers } from '@features/users/store/users';
import { markRead } from '@/network/irc/readMarkers';
import { setCurrentWindow } from './store/networks';

export const setCurrentChannelName = (channelName: string, category: ChannelCategory): void => {
  setCurrentWindow(channelName, category);

  setClearUnreadMessages(channelName);
  markRead(channelName);

  useCurrentStore.getState().setUpdateTopic(getTopic(channelName));
  useCurrentStore.getState().setUpdateMessages(getMessages(channelName));
  // Paint the new channel immediately rather than after a queued roster sync
  flushCurrentUsers();
  useCurrentStore.getState().setUpdateTyping(getTyping(channelName));
};
