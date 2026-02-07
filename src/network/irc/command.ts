import { defaultQuitMessage, STATUS_CHANNEL } from '@/config/config';
import { useChannelsStore, isChannel, setAddMessage } from '@features/channels/store/channels';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import { MessageColor } from '@/config/theme';
import i18next from '@/app/i18n';

export const generalCommands = [
  '/amsg', '/all', '/away', '/help', '/join', '/logout', '/quit', '/raw', '/quote', '/msg',
  '/whois', '/whereis', '/who', '/notice', '/nick', '/mode', '/whowas', '/names', '/knock', '/watch',
  '/ns', '/cs', '/hs', '/bs', '/ms'
];
export const channelCommands = [
  '/ban', '/cycle', '/hop', '/invite', '/kb', '/kban', '/kick', '/me', '/part', '/topic',
  '/op', '/deop', '/voice', '/devoice', '/halfop', '/dehalfop'
];

const stripCRLF = (input: string): string => input.replace(/[\r\n]/g, '');

export const parseMessageToCommand = (channel: string, message: string): string => {
  message = stripCRLF(message);

  if (message?.startsWith('/')) {
    message = message.substring(1);
  }

  const originalLine = message;
  const line = message.split(' ');

  const command = line.shift()?.toLowerCase();

  switch (command) {
    case 'amsg':
    case 'all':
      return allCommand(line) ?? originalLine;
    case 'help':
      return helpCommand(channel);
    case 'j':
      return joinCommand(line);
    case 'logout':
    case 'quit':
    case 'q':
      return quitCommand(line);
    case 'raw':
    case 'quote':
    case 'msg':
      return quoteCommand(line);
    case 'whereis':
      return whoisCommand(line);
    case 'who':
      return originalLine;
    // Services commands
    case 'ns':
      return servicesCommand('NickServ', line);
    case 'cs':
      return servicesCommand('ChanServ', line);
    case 'hs':
      return servicesCommand('HostServ', line);
    case 'bs':
      return servicesCommand('BotServ', line);
    case 'ms':
      return servicesCommand('MemoServ', line);
    // General commands
    case 'notice':
      return noticeCommand(line) ?? originalLine;
    case 'nick':
      return nickCommand(line) ?? originalLine;
    case 'mode':
      return modeCommand(line);
    case 'whowas':
      return whowasCommand(line) ?? originalLine;
    case 'names':
      return namesCommand(line);
    case 'knock':
      return knockCommand(line) ?? originalLine;
    case 'watch':
      return watchCommand(line);
  }

  if (channel !== STATUS_CHANNEL) {
    switch (command) {
      case 'ban':
      case 'b':
        return banCommand(channel, line) ?? originalLine;
      case 'cycle':
      case 'hop':
        return cycleCommand(channel, line);
      case 'invite':
        return inviteCommand(channel, line) ?? originalLine;
      case 'kb':
      case 'kban':
        return kickBanCommand(channel, line) ?? originalLine;
      case 'kick':
      case 'k':
        return kickCommand(channel, line) ?? originalLine;
      case 'me':
        return meCommand(channel, line) ?? originalLine;
      case 'part':
      case 'p':
        return partCommand(channel, line);
      case 'topic':
        return topicCommand(channel, line);
      // Quick mode commands
      case 'op':
        return quickModeCommand(channel, line, '+o') ?? originalLine;
      case 'deop':
        return quickModeCommand(channel, line, '-o') ?? originalLine;
      case 'voice':
        return quickModeCommand(channel, line, '+v') ?? originalLine;
      case 'devoice':
        return quickModeCommand(channel, line, '-v') ?? originalLine;
      case 'halfop':
        return quickModeCommand(channel, line, '+h') ?? originalLine;
      case 'dehalfop':
        return quickModeCommand(channel, line, '-h') ?? originalLine;
    }
  }

  return originalLine;
};

const joinCommand = (line: string[]): string => {
  return `JOIN ${line.join(' ')}`;
};

const quitCommand = (line: string[]): string => {
  return `QUIT ${line.length !== 0 ? line.join(' ') : defaultQuitMessage}`;
};

const quoteCommand = (line: string[]): string => {
  return line.join(' ');
};

const whoisCommand = (line: string[]): string => {
  return `WHOIS ${line.join(' ')}`;
};

const cycleCommand = (channel: string, line: string[]): string => {
  const reason = line.join(' ');

  if (reason.length !== 0) {
    return `PART ${channel} :${reason}\nJOIN ${channel}`;
  }
  return `PART ${channel}\nJOIN ${channel}`;
};

const inviteCommand = (channel: string, line: string[]): string | undefined => {
  const user = line.shift();

  if (user === undefined) {
    return undefined;
  }

  return `INVITE ${user} ${channel}`;
};

const kickCommand = (channel: string, line: string[]): string | undefined => {
  const user = line.shift();

  if (user === undefined) {
    return undefined;
  }

  let reason = line.join(' ');
  if (reason.length !== 0) {
    reason = ` :${reason}`;
  }

  return `KICK ${channel} ${user}${reason}`;
};

const partCommand = (channel: string, line: string[]): string => {
  let reason = line.join(' ');
  if (reason.length !== 0) {
    reason = ` :${reason}`;
  }

  return `PART ${channel}${reason}`;
};

const topicCommand = (channel: string, line: string[]): string => {
  return `TOPIC ${channel} :${line.join(' ')}`;
};

const banCommand = (channel: string, line: string[]): string | undefined => {
  const mask = line.shift();

  if (mask === undefined) {
    return `MODE ${channel} +b`;
  }

  return `MODE ${channel} +b ${mask}`;
};

const kickBanCommand = (channel: string, line: string[]): string | undefined => {
  const user = line.shift();

  if (user === undefined) {
    return undefined;
  }

  let reason = line.join(' ');
  if (reason.length !== 0) {
    reason = ` :${reason}`;
  }

  return `MODE ${channel} +b ${user}\nKICK ${channel} ${user}${reason}`;
};

const meCommand = (channel: string, line: string[]): string | undefined => {
  const action = line.join(' ');

  if (action.length === 0) {
    return undefined;
  }

  return `PRIVMSG ${channel} :\x01ACTION ${action}\x01`;
};

const allCommand = (line: string[]): string | undefined => {
  const message = line.join(' ');

  if (message.length === 0) {
    return undefined;
  }

  const channels = useChannelsStore
    .getState()
    .openChannels.filter((channel) => isChannel(channel.name))
    .map((channel) => channel.name);

  if (channels.length === 0) {
    return undefined;
  }

  return channels.map((channel) => `PRIVMSG ${channel} :${message}`).join('\n');
};

// Services commands - shortcuts for common IRC services
const servicesCommand = (service: string, line: string[]): string => {
  const command = line.join(' ');
  if (command.length === 0) {
    return `PRIVMSG ${service} :HELP`;
  }
  return `PRIVMSG ${service} :${command}`;
};

// Send NOTICE message
const noticeCommand = (line: string[]): string | undefined => {
  const target = line.shift();
  const message = line.join(' ');
  if (!target || message.length === 0) {
    return undefined;
  }
  return `NOTICE ${target} :${message}`;
};

// Change nickname
const nickCommand = (line: string[]): string | undefined => {
  const newNick = line.shift();
  if (!newNick) {
    return undefined;
  }
  return `NICK ${newNick}`;
};

// View/set modes
const modeCommand = (line: string[]): string => {
  return `MODE ${line.join(' ')}`;
};

// Historical user lookup
const whowasCommand = (line: string[]): string | undefined => {
  const nick = line.shift();
  if (!nick) {
    return undefined;
  }
  return `WHOWAS ${nick}`;
};

// List channel users
const namesCommand = (line: string[]): string => {
  const channel = line.shift();
  return channel ? `NAMES ${channel}` : 'NAMES';
};

// Request entry to invite-only channel
const knockCommand = (line: string[]): string | undefined => {
  const channel = line.shift();
  if (!channel) {
    return undefined;
  }
  const message = line.join(' ');
  return message.length > 0 ? `KNOCK ${channel} :${message}` : `KNOCK ${channel}`;
};

// WATCH command for friend list
const watchCommand = (line: string[]): string => {
  const action = line.join(' ');
  if (action.length === 0) {
    return 'WATCH L'; // List current watches
  }
  return `WATCH ${action}`;
};

// Quick mode change commands
const quickModeCommand = (channel: string, line: string[], mode: string): string | undefined => {
  const nick = line.shift();
  if (!nick) {
    return undefined;
  }
  return `MODE ${channel} ${mode} ${nick}`;
};

const helpCommands = [
  { cmd: '/all, /amsg <message>', key: 'help.cmd.all' },
  { cmd: '/away [message]', key: 'help.cmd.away' },
  { cmd: '/ban, /b [mask]', key: 'help.cmd.ban' },
  { cmd: '/bs <command>', key: 'help.cmd.bs' },
  { cmd: '/cs <command>', key: 'help.cmd.cs' },
  { cmd: '/cycle, /hop [reason]', key: 'help.cmd.cycle' },
  { cmd: '/dehalfop <nick>', key: 'help.cmd.dehalfop' },
  { cmd: '/deop <nick>', key: 'help.cmd.deop' },
  { cmd: '/devoice <nick>', key: 'help.cmd.devoice' },
  { cmd: '/halfop <nick>', key: 'help.cmd.halfop' },
  { cmd: '/help', key: 'help.cmd.help' },
  { cmd: '/hs <command>', key: 'help.cmd.hs' },
  { cmd: '/invite <nick>', key: 'help.cmd.invite' },
  { cmd: '/join, /j <channel>', key: 'help.cmd.join' },
  { cmd: '/kb, /kban <nick> [reason]', key: 'help.cmd.kban' },
  { cmd: '/kick, /k <nick> [reason]', key: 'help.cmd.kick' },
  { cmd: '/knock <channel> [message]', key: 'help.cmd.knock' },
  { cmd: '/me <action>', key: 'help.cmd.me' },
  { cmd: '/mode <target> [modes]', key: 'help.cmd.mode' },
  { cmd: '/msg, /raw, /quote <raw>', key: 'help.cmd.raw' },
  { cmd: '/ms <command>', key: 'help.cmd.ms' },
  { cmd: '/names [channel]', key: 'help.cmd.names' },
  { cmd: '/nick <newnick>', key: 'help.cmd.nick' },
  { cmd: '/notice <target> <message>', key: 'help.cmd.notice' },
  { cmd: '/ns <command>', key: 'help.cmd.ns' },
  { cmd: '/op <nick>', key: 'help.cmd.op' },
  { cmd: '/part, /p [reason]', key: 'help.cmd.part' },
  { cmd: '/quit, /q [reason]', key: 'help.cmd.quit' },
  { cmd: '/topic <text>', key: 'help.cmd.topic' },
  { cmd: '/voice <nick>', key: 'help.cmd.voice' },
  { cmd: '/watch [+/-nick]', key: 'help.cmd.watch' },
  { cmd: '/whois, /whereis <nick>', key: 'help.cmd.whois' },
  { cmd: '/who <mask>', key: 'help.cmd.who' },
  { cmd: '/whowas <nick>', key: 'help.cmd.whowas' },
];

const helpCommand = (channel: string): string => {
  const time = new Date().toISOString();

  setAddMessage({
    id: uuidv4(),
    message: i18next.t('help.title'),
    target: channel,
    time,
    category: MessageCategory.info,
    color: MessageColor.default,
  });

  for (const { cmd, key } of helpCommands) {
    setAddMessage({
      id: uuidv4(),
      message: `${cmd} - ${i18next.t(key)}`,
      target: channel,
      time,
      category: MessageCategory.info,
      color: MessageColor.default,
    });
  }

  return '';
};
