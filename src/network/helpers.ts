import { defaultIRCPort } from '../config/config';
import { type Server } from '../models/servers';
import { type UserMode, type Nick, type ParsedIrcRawMessage, type SingleServer, type ChannelMode } from '../types';

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
    const tagsList = line.shift()?.substring(1).split(';') ?? [];
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
  let nick = fullNick.substring(fullNick.startsWith(':') ? 1 : 0, fullNick.lastIndexOf('!') !== -1 ? fullNick.lastIndexOf('!') : fullNick.length);

  for (const userMode of userModes) {
    if (nick.startsWith(userMode.symbol)) {
      modes.push(userMode.mode);
      nick = nick.substring(1);
    }
  }

  let ident = '';
  let hostname = '';
  if (fullNick.lastIndexOf('!') !== -1 && fullNick.lastIndexOf('@') !== -1) {
    ident = fullNick.substring(fullNick.lastIndexOf('!') + 1, fullNick.lastIndexOf('@'));
    hostname = fullNick.substring(fullNick.lastIndexOf('@') + 1);
  }

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
 * That function parse line modes from IRC server "(yqaohv)!~&@%+" and returns it as array:
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

/**
 * CHANMODES=A,B,C,D

   The CHANMODES parameter is used to indicate the channel modes
   available and the arguments they take.  There are four categories of
   modes, defined as follows:
   -  Type A: Modes that add or remove an address to or from a list.
      These modes MUST always have a parameter when sent from the server
      to a client.  A client MAY issue the mode without an argument to
      obtain the current contents of the list.

   -  Type B: Modes that change a setting on a channel.  These modes
      MUST always have a parameter.

   -  Type C: Modes that change a setting on a channel.  These modes
      MUST have a parameter when being set, and MUST NOT have a
      parameter when being unset.

   -  Type D: Modes that change a setting on a channel.  These modes
      MUST NOT have a parameter.

   To allow for future extensions, a server MAY send additional types,
   delimeted by the comma character (',').  The behaviour of any
   additional types is undefined.

   Example: beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ

 * @param modes 
 * @returns 
 */
export const parseChannelModes = (modes: string | undefined): ChannelMode => {
  const result: ChannelMode = {
    A: [],
    B: [],
    C: [],
    D: [],
  };

  if (modes === undefined) {
    return result;
  }

  const list = modes.split(',');
  result.A = list.shift()?.split('') ?? []; // both
  result.B = list.shift()?.split('') ?? []; // both
  result.C = list.shift()?.split('') ?? []; // add
  result.D = list.shift()?.split('') ?? []; // single

  return result;
};

export const channelModeType = (flag: string, channelModes: ChannelMode, userModes: UserMode[]): 'A' | 'B' | 'C' | 'D' | 'U' | undefined => {
  if (channelModes.A.includes(flag)) {
    return 'A';
  }
  if (channelModes.B.includes(flag)) {
    return 'B';
  }
  if (channelModes.C.includes(flag)) {
    return 'C';
  }
  if (channelModes.D.includes(flag)) {
    return 'D';
  }
  if (userModes.find((item) => item.mode === flag) !== undefined) {
    return 'U';
  }

  return undefined;
};
