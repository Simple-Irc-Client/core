export interface SingleServer {
  host?: string
  port: number
}

export interface ParsedIrcRawMessage {
  tags: Record<string, string>
  sender: string
  command: string
  line: string[]
}

export interface ChannelList {
  name: string
  users: number
  topic: string
}

export interface Message {
  message: string
  nick: User | string | undefined
  target: string
  time: string
  category: MessageCategory
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
  highlight = 'highlight',
  motd = 'motd',
}

export interface Channel {
  category: ChannelCategory
  messages: Message[]
  name: string
  topic: string
  topicSetBy: string
  topicSetTime: number
  unReadMessages: number
}

export enum ChannelCategory {
  channel = 'channel',
  priv = 'priv',
  status = 'status',
  debug = 'debug',
}

export interface User {
  nick: string
  ident: string
  hostname: string
  avatarUrl: string
  modes: string[]
  maxMode: number
  channels: string[]
}

export interface UserMode {
  symbol: string
  mode: string
}

export interface Nick {
  nick: string
  ident: string
  hostname: string
}
