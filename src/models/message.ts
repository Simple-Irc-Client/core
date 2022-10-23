import type { User } from "./user";

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
