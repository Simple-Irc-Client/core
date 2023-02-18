import { STATUS_CHANNEL } from '../config';

export const parseMessageToCommand = (channel: string, message: string): string => {
  if (message?.[0] === '/') {
    message = message.substring(1);
  }

  const line = message.split(' ');

  switch (line?.[0]) {
    case 'amsg':
    case 'all':
      break;
    case 'away':
      break;
    case 'help':
      break;
    case 'join':
    case 'j':
      break;
    case 'logout':
    case 'quit':
    case 'q':
      break;
    case 'priv':
    case 'query':
      break;
    case 'raw':
    case 'quote':
    case 'msg':
      return quoteCommand(line);
    case 'whois':
    case 'whereis':
      break;
    case 'who':
      break;
  }

  if (channel !== STATUS_CHANNEL) {
    switch (line?.[0]) {
      case 'ban':
        break;
      case 'cycle':
      case 'hop':
        break;
      case 'invite':
        break;
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

const quoteCommand = (line: string[]): string => {
  line.shift();

  return line.join(' ');
};
