import type { Message } from "./message";

export type Channel = {
  category: ChannelCategory;
  messages: Message[];
  name: string;
  topic: string;
  topicSetBy: string;
  topicSetTime: number;
  unReadMessages: string;
};

export enum ChannelCategory {
  channel = "channel",
  priv = "priv",
  status = "status",
  debug = "debug",
}
