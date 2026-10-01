// Messages use the User snapshot embedded at message time; everything else looks up the live store

import { getUser } from '@features/users/store/users';
import { getChannel } from '@features/channels/store/channels';
import { type Message } from '@shared/types';

export const getUserDisplayName = (nick: string): string => {
  const user = getUser(nick);
  return user?.displayName || nick;
};

export const getChannelDisplayName = (channelName: string): string => {
  const channel = getChannel(channelName);
  return channel?.displayName || channelName;
};

export const getNickFromMessage = (message: Message | undefined): string | undefined => {
  if (!message?.nick) { return undefined; }
  return typeof message.nick === 'string' ? message.nick : message.nick.nick;
};

export const getDisplayNickFromMessage = (message: Message | undefined): string => {
  if (!message?.nick) { return ''; }

  // System messages carry a plain nick string
  if (typeof message.nick === 'string') {
    return getUserDisplayName(message.nick);
  }

  return message.nick.displayName || message.nick.nick;
};
