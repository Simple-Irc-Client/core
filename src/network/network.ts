import { connect as socketIOConnect } from 'socket.io-client';
import { websocketHost, websocketPort } from '../config/config';
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
  ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${password}`);
};

export const ircSendList = (): void => {
  ircSendRawMessage(`LIST`);
};

export const ircSendNamesXProto = (): void => {
  ircSendRawMessage(`PROTOCTL NAMESX`);
};

export const ircJoinChannels = (channels: string[]): void => {
  ircSendRawMessage(`JOIN ${channels.join(',')}`);
};

export const ircPartChannel = (channel: string): void => {
  ircSendRawMessage(`PART ${channel}`);
};

export const ircRequestMetadataItem = (nick: string, item: string): void => {
  ircSendRawMessage(`METADATA ${nick} GET ${item}`, true);
};

export const ircRequestMetadata = (nick: string): void => {
  ircSendRawMessage(`METADATA ${nick} LIST`, true);
};

export const ircSendRawMessage = (data: string, queue?: boolean): void => {
  const command = {
    type: 'raw',
    event: {
      rawData: `${data}\n`,
    },
  };

  if (queue === true) {
    sendQueueMessage(command);
  } else {
    sendMessage(command);
  }
};

const sendMessage = (message: unknown): void => {
  sicSocket.emit('sic-client-event', message);
};

const sendQueueMessage = (message: unknown): void => {
  queueIrcMessages.push(message);
};

setInterval(function networkSendQueueMessages() {
  if (queueIrcMessages.length === 0) {
    return;
  }

  const message = queueIrcMessages.pop();
  if (message === undefined) {
    return;
  }
  sicSocket.emit('sic-client-event', message);
}, 300);
