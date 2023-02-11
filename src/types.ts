export type SingleServer = {
  host?: string;
  port: number;
};

export type ParsedIrcRawMessage = {
  tags: string;
  sender: string;
  command: string;
  line: string[];
};

export type ChannelList = {
  name: string;
  users: number;
  topic: string;
};

export type Message = {
  message: string;
  nick: User | string | undefined;
  target: string;
  time: number;
  category: MessageCategory;
};

export enum MessageCategory {
  default = "default",
  join = "join",
  part = "part",
  quit = "quit",
  kick = "kick",
  mode = "mode",
  notice = "notice",
  info = "info",
  me = "me",
  error = "error",
  highlight = "highlight",
  motd = "motd",
}

export type Channel = {
  category: ChannelCategory;
  messages: Message[];
  name: string;
  topic: string;
  topicSetBy: string;
  topicSetTime: number;
  unReadMessages: number;
};

export enum ChannelCategory {
  channel = "channel",
  priv = "priv",
  status = "status",
  debug = "debug",
}

export type User = {
  nick: string;
  ident: string;
  hostname: string;
  avatarUrl: string;
  avatarData: string;
  modes: string[];
  maxMode: number;
  channels: string[];
};

export type UserMode = {
  symbol: string;
  mode: string;
};
