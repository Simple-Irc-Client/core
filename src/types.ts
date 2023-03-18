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

export interface Message {
  id: string;
  message: string;
  nick?: User | string;
  target: string;
  time: string;
  category: MessageCategory;
  color?: MessageColor;
}

export enum MessageCategory {
  default = 'default',
  join = 'join',
  part = 'part',
  quit = 'quit',
  kick = 'kick',
  mode = 'mode',
  notice = 'notice',
  info = 'info',
  me = 'me',
  error = 'error',
  // highlight = 'highlight',
  motd = 'motd',
}

export type UserTypingStatus = 'active' | 'paused' | 'done';

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

export enum ChannelCategory {
  channel = 'channel',
  priv = 'priv',
  status = 'status',
  debug = 'debug',
}

export interface User {
  nick: string;
  ident: string;
  hostname: string;
  avatar?: string; // ircv3
  color?: string; // ircv3
  modes: string[];
  maxMode: number;
  channels: string[];
}

export interface UserMode {
  symbol: string;
  mode: string;
}

export interface Nick {
  modes: string[];
  nick: string;
  ident: string;
  hostname: string;
}
