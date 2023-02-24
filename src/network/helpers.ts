import { defaultIRCPort } from '../config';
import { type Server } from '../models/servers';
import { type UserMode, type Nick, type ParsedIrcRawMessage, type SingleServer } from '../types';

/**
 *
 * @param currentServer
 * @returns
 */
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

/**
 *
 * @param message
 * @returns
 */
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

/**
 * Parse nick and return ident, hostname and user modes
 * @param fullNick
 * @param userModes
 * @returns
 */
export const parseNick = (fullNick: string, userModes: UserMode[]): Nick => {
  const modes: string[] = [];
  let nick = fullNick.substring(fullNick.startsWith(':') ? 1 : 0, fullNick.lastIndexOf('!'));

  for (const userMode of userModes) {
    if (nick.startsWith(userMode.symbol)) {
      modes.push(userMode.mode);
      nick = nick.substring(1);
    }
  }

  const ident = fullNick.substring(fullNick.lastIndexOf('!') + 1, fullNick.lastIndexOf('@'));
  const hostname = fullNick.substring(fullNick.lastIndexOf('@') + 1);

  return { modes, nick, ident, hostname };
};

/**
 * That func is returning maximum int number based on user mode
 * Based on that int number we'll be sorting users and user with higher mode (int) will be first on users list
 * @param userModes
 * @param serverModes
 * @returns
 */
export const createMaxMode = (userModes: string[], serverModes: UserMode[]): number => {
  let maxMode = -1;
  userModes.forEach((userMode: string) => {
    const modeIndex: number = serverModes.findIndex((mode: UserMode) => mode.mode === userMode);
    let newMaxMode = -1;
    if (modeIndex !== -1) {
      newMaxMode = 256 - modeIndex;
    }
    if (newMaxMode > maxMode) {
      maxMode = newMaxMode;
    }
  });
  return maxMode;
};

/**
 * That function parse line modes from IRC server "(qaohv)~&@%+" and returns it as array:
 * [
 *   ["mode": "q", symbol: "~"],
 *   ["mode": "a", symbol: "&"],
 *   ["mode": "o", symbol: "@"],
 * ]
 * @param userPrefixes
 * @returns
 */
export const parseUserModes = (userPrefixes: string | undefined): UserMode[] => {
  const result: UserMode[] = [];

  if (userPrefixes === undefined) {
    return result;
  }

  if (userPrefixes?.startsWith('(')) {
    userPrefixes = userPrefixes.substring(1);
  }

  const [modes, symbols] = userPrefixes?.split(')');
  if (modes !== undefined && symbols !== undefined && modes?.length === symbols?.length) {
    for (let i = 0; i < modes.length; i++) {
      if (modes?.[i] !== undefined && symbols?.[i] !== undefined) {
        result.push({
          mode: modes[i] ?? '',
          symbol: symbols[i] ?? '',
        });
      }
    }
  }

  return result;
};
