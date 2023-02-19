import { connect as socketIOConnect } from 'socket.io-client';
import { websocketHost, websocketPort } from '../config';
import { type Server } from '../models/servers';
import { parseServer } from './helpers';

export const sicSocket = socketIOConnect(`${websocketHost}:${websocketPort}`, {
  transports: ['websocket'],
  path: '/SimpleIrcClient',
});

const queueIrcMessages: unknown[] = [];

export const ircConnect = (currentServer: Server, nick: string): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer?.host === undefined || singleServer?.host === '') {
    throw new Error('Unable to connect to IRC network - server host is empty');
  }

  const command = {
    type: 'connect',
    event: {
      nick,
      server: {
        host: singleServer.host,
        port: singleServer.port,
        encoding: currentServer?.encoding,
      },
    },
  };

  sendMessage(command);
};

export const ircSendPassword = (password: string): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: `PRIVMSG NickServ :IDENTIFY ${password}\n`,
    },
  };

  sendMessage(command);
};

export const ircSendList = (): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: 'LIST\n',
    },
  };

  sendMessage(command);
};

export const ircSendNamesXProto = (): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: 'PROTOCTL NAMESX\n',
    },
  };

  sendMessage(command);
};

export const ircJoinChannels = (channels: string[]): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: `JOIN ${channels.join(',')}\n`,
    },
  };

  sendMessage(command);
};

export const ircRequestMetadata = (nick: string, item: string): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: `METADATA ${nick} GET ${item}\n`,
    },
  };

  sendQueueMessage(command);
};

export const ircSendRawMessage = (data: string): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: `${data}\n`,
    },
  };

  sendMessage(command);
};

const sendMessage = (message: unknown): void => {
  sicSocket.emit('sic-client-event', message);
};

const sendQueueMessage = (message: unknown): void => {
  queueIrcMessages.push(message);
};

setInterval(function networkSendQueueMessages() {
  const message = queueIrcMessages.pop();
  if (message === undefined) {
    return;
  }
  sicSocket.emit('sic-client-event', message);
}, 300);
