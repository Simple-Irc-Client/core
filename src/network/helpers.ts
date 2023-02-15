import { defaultIRCPort } from '../config';
import { type Server } from '../models/servers';
import { type Nick, type ParsedIrcRawMessage, type SingleServer } from '../types';

export const parseServer = (currentServer?: Server): SingleServer | undefined => {
  if (currentServer === undefined || currentServer?.servers?.length === 0) {
    return undefined;
  }

  const firstServer = currentServer.servers?.[0];

  if (firstServer === undefined) {
    return undefined;
  }

  let serverHost: string | undefined = firstServer;
  let serverPort: string | undefined = `${defaultIRCPort}`;

  if (firstServer.includes(':')) {
    [serverHost, serverPort] = firstServer?.split(':');
  }

  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing
  return { host: serverHost, port: Number(serverPort || `${defaultIRCPort}`) };
};

export const parseIrcRawMessage = (message: string): ParsedIrcRawMessage => {
  const line: string[] = message?.trim()?.split(' ') ?? [];

  // @msgid=rPQvwimgWqGnqVcuVONIFJ;time=2023-02-01T23:08:26.026Z
  // @draft/bot;msgid=oZvJsXO82XJXWMsnlSFTD5;time=2023-02-01T22:54:54.532Z
  const tags: Record<string, string> = {};
  if ((line?.[0] ?? '').startsWith('@')) {
    const tagsList = line.shift()?.split(';') ?? [];
    for (const tag of tagsList) {
      if (!tag.includes('=')) {
        tags[tag] = '';
      } else {
        const key = tag.substring(0, tag.indexOf('='));
        const value = tag.substring(tag.indexOf('=') + 1);
        tags[key] = value;
      }
    }
  }

  // NickServ!NickServ@serwisy.pirc.pl
  let sender = '';
  if ((line?.[0] ?? '').startsWith(':')) {
    sender = line.shift() ?? '';
    if (sender?.[0] === ':') {
      sender = sender.substring(1);
    }
  }

  const command = line.shift() ?? '';

  return { tags, sender, command, line };
};

export const parseNick = (fullNick: string): Nick => {
  const nick = fullNick.substring(fullNick.startsWith(':') ? 1 : 0, fullNick.indexOf('!'));
  const ident = fullNick.substring(fullNick.indexOf('!') + 1, fullNick.indexOf('@'));
  const hostname = fullNick.substring(fullNick.indexOf('@') + 1);
  return { nick, ident, hostname };
};
