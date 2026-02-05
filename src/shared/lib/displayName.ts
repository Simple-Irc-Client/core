/**
 * IRC v3 display-name utilities
 *
 * Design:
 * - Messages use snapshot (embedded User data at message time)
 * - User list uses live lookup (current store state)
 */

import { getUser } from '@features/users/store/users';
import { getChannel } from '@features/channels/store/channels';
import { type Message } from '@shared/types';

/**
 * Get current display name for a user (live lookup)
 * Use for: user lists, typing indicators, presence
 */
export const getUserDisplayName = (nick: string): string => {
  const user = getUser(nick);
  return user?.displayName || nick;
};

/**
 * Get current display name for a channel (live lookup)
 * Use for: channel list, headers
 */
export const getChannelDisplayName = (channelName: string): string => {
  const channel = getChannel(channelName);
  return channel?.displayName || channelName;
};

/**
 * Extract nick string from a Message
 */
export const getNickFromMessage = (message: Message | undefined): string | undefined => {
  if (!message?.nick) return undefined;
  return typeof message.nick === 'string' ? message.nick : message.nick.nick;
};

/**
 * Get display name from message (snapshot approach)
 * Uses embedded User object if available, falls back to live lookup for string nicks
 */
export const getDisplayNickFromMessage = (message: Message | undefined): string => {
  if (!message?.nick) return '';

  // String nick (system messages) - live lookup
  if (typeof message.nick === 'string') {
    return getUserDisplayName(message.nick);
  }

  // User object - use snapshot data
  return message.nick.displayName || message.nick.nick;
};
