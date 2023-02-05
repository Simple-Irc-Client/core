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
