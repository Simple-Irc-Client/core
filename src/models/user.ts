import type { Channel } from "./channel";

export type User = {
  nick: string;
  ident: string;
  hostname: string;
  avatarUrl: string;
  avatarData: string;
  modes: string[];
  maxMode: number;
  channels: Channel[];
};

export type UserMode = {
  symbol: string;
  mode: string;
};
