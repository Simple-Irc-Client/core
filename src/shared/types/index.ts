import { type MessageColor } from '@/config/theme';

export interface SingleServer {
  host?: string;
  port: number;
  tls?: boolean;
}

export interface ParsedIrcRawMessage {
  tags: Record<string, string>;
  sender: string;
  command: string;
  line: string[];
}

export interface ChannelList {
  name: string;
  users: number;
  topic: string;
}

export const MessageCategory = {
  default: 'default',
  join: 'join',
  part: 'part',
  quit: 'quit',
  kick: 'kick',
  mode: 'mode',
  notice: 'notice',
  info: 'info',
  me: 'me',
  error: 'error',
  motd: 'motd',
} as const;

export type MessageCategory = (typeof MessageCategory)[keyof typeof MessageCategory];

export interface Message {
  id: string;
  message: string;
  nick?: User | string;
  target: string;
  time: string;
  category: MessageCategory;
  color?: MessageColor;
  /**
   * IRCv3 echo-message: true when this message was confirmed by the server
   */
  echoed?: boolean;
}

export type UserTypingStatus = 'active' | 'paused' | 'done';

export const ChannelCategory = {
  channel: 'channel',
  priv: 'priv',
  status: 'status',
  debug: 'debug',
} as const;

export type ChannelCategory = (typeof ChannelCategory)[keyof typeof ChannelCategory];

export interface Channel {
  name: string;
  category: ChannelCategory;
  unReadMessages: number;
  /**
   * IRCv3 - Channel's avatar URL from metadata
   */
  avatar?: string;
  /**
   * IRCv3 - Channel's display name from METADATA
   */
  displayName?: string;
}

export interface ChannelExtended extends Channel {
  messages: Message[];
  topic: string;
  topicSetBy: string;
  topicSetTime: number;
  typing: string[]; // Record<string, UserTypingStatus>;
}

export interface User {
  nick: string;
  ident: string;
  hostname: string;
  /**
   * IRCv3 - User's avatar URL from metadata
   */
  avatar?: string;
  /**
   * IRCv3 - User's color preference from metadata
   */
  color?: string;
  /**
   * IRCv3 - User's account name (from account-notify/account-tag)
   */
  account?: string;
  /**
   * IRCv3 - User's real name (from extended-join/SETNAME)
   */
  realname?: string;
  /**
   * IRCv3 - Whether the user is away (from away-notify)
   */
  away?: boolean;
  /**
   * IRCv3 - User's away reason (from away-notify)
   */
  awayReason?: string;
  /**
   * IRCv3 - User's display name from METADATA
   */
  displayName?: string;
  /**
   * IRCv3 - User's status text from METADATA
   */
  status?: string;
  /**
   * Global flags - like Away
   */
  flags: string[];
  channels: UserChannel[];
}

export interface UserChannel {
  name: string;
  flags: string[]; // yqoahv
  maxPermission: number; // max perms based on flags
}

export interface UserMode {
  symbol: string;
  flag: string;
}

export interface ChannelMode {
  A: string[];
  B: string[];
  C: string[];
  D: string[];
  U?: string[]; // user flags
}

export interface Nick {
  nick: string;
  ident: string;
  hostname: string;
  flags: string[];
}
