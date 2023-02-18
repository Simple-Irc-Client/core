import { defaultQuitMessage, STATUS_CHANNEL } from '../config';

export const parseMessageToCommand = (channel: string, message: string): string => {
  if (message?.[0] === '/') {
    message = message.substring(1);
  }

  const line = message.split(' ');

  switch (line?.[0]?.toLowerCase()) {
    case 'amsg':
    case 'all':
      break;
    case 'away':
      return awayCommand(line);
    case 'help':
      break;
    case 'join':
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
    case 'whois':
    case 'whereis':
      return whoisCommand(line);
    case 'who':
      return whoCommand(line);
  }

  if (channel !== STATUS_CHANNEL) {
    switch (line?.[0]?.toLowerCase()) {
      case 'ban':
        break;
      case 'cycle':
      case 'hop':
        break;
      case 'invite':
        break;
      case 'kb':
      case 'kban':
        break;
      case 'kick':
      case 'k':
        break;
      case 'me':
        break;
      case 'part':
      case 'p':
        break;
      case 'topic':
        break;
    }
  }

  return line.join(' ');
};

const awayCommand = (line: string[]): string => {
  return line.join(' ');
};

const joinCommand = (line: string[]): string => {
  line.shift();

  return `JOIN ${line.join(' ')}`;
};

const quitCommand = (line: string[]): string => {
  line.shift();

  return `QUIT ${line.length !== 0 ? line.join(' ') : defaultQuitMessage}`;
};

const quoteCommand = (line: string[]): string => {
  line.shift();

  return line.join(' ');
};

const whoisCommand = (line: string[]): string => {
  line.shift();

  return `WHOIS ${line.join(' ')}`;
};

const whoCommand = (line: string[]): string => {
  line.shift();

  return `WHO ${line.join(' ')}`;
};
