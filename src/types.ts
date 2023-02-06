export type SingleServer = {
  host?: string;
  port: number;
};

export type ParsedIrcRawMessage = {
  tags: string;
  sender: string;
  command: string;
  line: string[];
}

export type Channel = {
  name: string;
  users: number;
  topic: string;
}
