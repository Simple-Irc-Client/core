import { defaultQuitMessage, STATUS_CHANNEL } from '../../config/config';
import { useChannelsStore, isChannel, setAddMessage } from '../../store/channels';
import { MessageCategory } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { MessageColor } from '../../config/theme';
import i18next from '../../i18n';

export const generalCommands = ['/amsg', '/all', '/away', '/help', '/join', '/logout', '/quit', '/raw', '/quote', '/msg', '/whois', '/whereis', '/who'];
export const channelCommands = ['/ban', '/cycle', '/hop', '/invite', '/kb', '/kban', '/kick', '/me', '/part', '/topic'];

export const parseMessageToCommand = (channel: string, message: string): string => {
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

const helpCommands = [
  { cmd: '/all, /amsg <message>', key: 'help.cmd.all' },
  { cmd: '/away [message]', key: 'help.cmd.away' },
  { cmd: '/ban, /b [mask]', key: 'help.cmd.ban' },
  { cmd: '/cycle, /hop [reason]', key: 'help.cmd.cycle' },
  { cmd: '/help', key: 'help.cmd.help' },
  { cmd: '/invite <nick>', key: 'help.cmd.invite' },
  { cmd: '/join, /j <channel>', key: 'help.cmd.join' },
  { cmd: '/kb, /kban <nick> [reason]', key: 'help.cmd.kban' },
  { cmd: '/kick, /k <nick> [reason]', key: 'help.cmd.kick' },
  { cmd: '/me <action>', key: 'help.cmd.me' },
  { cmd: '/msg, /raw, /quote <raw>', key: 'help.cmd.raw' },
  { cmd: '/part, /p [reason]', key: 'help.cmd.part' },
  { cmd: '/quit, /q [reason]', key: 'help.cmd.quit' },
  { cmd: '/topic <text>', key: 'help.cmd.topic' },
  { cmd: '/whois, /whereis <nick>', key: 'help.cmd.whois' },
  { cmd: '/who <mask>', key: 'help.cmd.who' },
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
