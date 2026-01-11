import { type MessageColor } from './config/theme';

export interface SingleServer {
  host?: string;
  port: number;
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
   * ircv3
   */
  avatar?: string;
  /**
   * ircv3
   */
  color?: string;
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
