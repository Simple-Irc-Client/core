/**
 * Utility functions for handling display names from IRCv3 metadata
 */

import { getUser } from '@features/users/store/users';
import { getChannel } from '@features/channels/store/channels';

/**
 * Get the display name for a user, falling back to their nick if no display name is set
 * @param nick - The user's nick
 * @returns The display name if available, otherwise the nick
 */
export const getUserDisplayName = (nick: string): string => {
  const user = getUser(nick);
  return user?.displayName || nick;
};

/**
 * Get the display name for a channel, falling back to the channel name if no display name is set
 * @param channelName - The channel name
 * @returns The display name if available, otherwise the channel name
 */
export const getChannelDisplayName = (channelName: string): string => {
  const channel = getChannel(channelName);
  return channel?.displayName || channelName;
};