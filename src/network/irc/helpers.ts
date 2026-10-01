import { defaultIRCPort, defaultMaxPermission } from '@/config/config';
import { type Server } from './servers';
import { type UserMode, type Nick, type ParsedIrcRawMessage, type SingleServer, type ChannelMode } from '@shared/types';

/** "host", "host:port", "+host" or "+host:port" ("+" = TLS; default ports 6667 / 6697). */
export const parseServer = (currentServer?: Server): SingleServer | undefined => {
  if (currentServer === undefined || currentServer?.servers?.length === 0) {
    return undefined;
  }

  const firstServer = currentServer.servers?.[0];

  if (firstServer === undefined) {
    return undefined;
  }

  let tls = currentServer.tls ?? false;
  let serverString = firstServer;
  if (serverString.startsWith('+')) {
    tls = true;
    serverString = serverString.substring(1);
  }

  let serverHost: string | undefined = serverString;
  let serverPort: string | undefined = tls ? '6697' : `${defaultIRCPort}`;

  if (serverString.includes(':')) {
    [serverHost, serverPort] = serverString.split(':', 2);
  }

  return { host: serverHost, port: Number.parseInt(serverPort || `${defaultIRCPort}`, 10), tls };
};

/** https://ircv3.net/specs/extensions/message-tags.html: \: → ; | \s → space | \\ → \ | \r → CR | \n → LF */
export const unescapeTagValue = (value: string): string => {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      switch (next) {
        case ':': result += ';'; break;
        case 's': result += ' '; break;
        case '\\': result += '\\'; break;
        case 'r': result += '\r'; break;
        case 'n': result += '\n'; break;
        default: result += next; break;
      }
      i++;
    } else {
      result += value[i];
    }
  }
  return result;
};

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
        const rawValue = tag.substring(tag.indexOf('=') + 1);
        tags[key] = unescapeTagValue(rawValue);
      }
    }
  }

  // NickServ!NickServ@serwisy.pirc.pl
  let sender = '';
  if ((line?.[0] ?? '').startsWith(':')) {
    sender = line.shift() ?? '';
    if (sender?.startsWith(':')) {
      sender = sender.substring(1);
    }
  }

  const command = line.shift() ?? '';

  return { tags, sender, command, line };
};

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;
const MAX_NICK_PARSE_LENGTH = 100;

export const parseNick = (fullNick: string, userModes: UserMode[]): Nick => {
  const flags: string[] = [];
  let nick = fullNick.substring(fullNick.startsWith(':') ? 1 : 0, fullNick.lastIndexOf('!') !== -1 ? fullNick.lastIndexOf('!') : fullNick.length);

  for (const userMode of userModes) {
    if (nick.startsWith(userMode.symbol)) {
      flags.push(userMode.flag);
      nick = nick.substring(1);
    }
  }

  nick = nick.replace(CONTROL_CHAR_RE, '').slice(0, MAX_NICK_PARSE_LENGTH);
  if (nick.length === 0) {
    nick = '*';
  }

  let ident = '';
  let hostname = '';
  if (fullNick.lastIndexOf('!') !== -1 && fullNick.lastIndexOf('@') !== -1) {
    ident = fullNick.substring(fullNick.lastIndexOf('!') + 1, fullNick.lastIndexOf('@'));
    hostname = fullNick.substring(fullNick.lastIndexOf('@') + 1);
  }

  return { nick, ident, hostname, flags };
};

export const parseChannel = (channel: string, userModes: UserMode[]): string => {
  for (const userMode of userModes) {
    if (channel.startsWith(userMode.symbol)) {
      channel = channel.substring(1);
    }
  }

  return channel;
};

/** Sort key for the user list: the user's highest mode wins. */
export const calculateMaxPermission = (flags: string[], serverModes: UserMode[]): number => {
  let maxPermission = defaultMaxPermission;
  flags.forEach((flag: string) => {
    const modeIndex: number = serverModes.findIndex((mode: UserMode) => mode.flag === flag);
    let permission = defaultMaxPermission;
    if (modeIndex !== -1) {
      permission = 256 - modeIndex;
    }
    if (permission > maxPermission) {
      maxPermission = permission;
    }
  });
  return maxPermission;
};

/** "(qao)~&@" → [{ flag: 'q', symbol: '~' }, ...] */
export const parseUserModes = (userPrefixes: string | undefined): UserMode[] => {
  const result: UserMode[] = [];

  if (userPrefixes === undefined) {
    return result;
  }

  if (userPrefixes?.startsWith('(')) {
    userPrefixes = userPrefixes.substring(1);
  }

  const [modes, symbols] = userPrefixes.split(')');
  if (modes !== undefined && symbols !== undefined && modes?.length === symbols?.length) {
    for (let i = 0; i < modes.length; i++) {
      if (modes?.[i] !== undefined && symbols?.[i] !== undefined) {
        result.push({
          flag: modes[i] ?? '',
          symbol: symbols[i] ?? '',
        });
      }
    }
  }

  return result;
};

/**
 * CHANMODES=A,B,C,D (e.g. beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ). A: list modes; B: always a param;
 * C: param only when set; D: never a param.
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
  if (userModes.find((item) => item.flag === flag) !== undefined) {
    return 'U';
  }

  return undefined;
};
