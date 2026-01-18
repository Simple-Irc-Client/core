import { websocketHost, websocketPort } from '@/config/config';
import { type Server } from './servers';
import { parseServer } from './helpers';

// Native WebSocket connection
let sicSocket: WebSocket | null = null;
let isConnecting = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventHandlers: Record<string, ((data: any) => void)[]> = {};

// Initialize WebSocket connection
export const initWebSocket = (): WebSocket => {
  // Return existing socket if it's open or connecting
  if (sicSocket && (sicSocket.readyState === WebSocket.OPEN || sicSocket.readyState === WebSocket.CONNECTING)) {
    return sicSocket;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    if (sicSocket) {
      return sicSocket;
    }
    // Wait a bit and try again if socket isn't created yet
    throw new Error('WebSocket connection already in progress');
  }

  isConnecting = true;
  sicSocket = new WebSocket(`ws://${websocketHost}:${websocketPort}/SimpleIrcClient`);

  sicSocket.onopen = () => {
    isConnecting = false;
    console.log('WebSocket connected');
    triggerEvent('connect', {});
  };

  sicSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as { event?: string; data?: unknown };
      if (data.event) {
        triggerEvent(data.event, data.data);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  sicSocket.onerror = (error) => {
    isConnecting = false;
    console.error('WebSocket error:', error);
    triggerEvent('error', error);
  };

  sicSocket.onclose = () => {
    isConnecting = false;
    console.log('WebSocket disconnected');
    triggerEvent('close', {});
    sicSocket = null;
  };

  return sicSocket;
};

// Event handler management
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const triggerEvent = (eventName: string, data: any) => {
  const handlers = eventHandlers[eventName] || [];
  handlers.forEach((handler) => handler(data));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const on = (eventName: string, callback: (data: any) => void): void => {
  if (!eventHandlers[eventName]) {
    eventHandlers[eventName] = [];
  }
  eventHandlers[eventName].push(callback);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const off = (eventName: string, callback: (data: any) => void): void => {
  const handlers = eventHandlers[eventName];
  if (handlers) {
    const index = handlers.indexOf(callback);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
};

export const getSocket = () => {
  if (!sicSocket) {
    return initWebSocket();
  }
  return sicSocket;
};

export const isConnected = (): boolean => {
  return sicSocket !== null && sicSocket.readyState === WebSocket.OPEN;
};

export const ircDisconnect = (): void => {
  // Clear the message queue
  queueIrcMessages.length = 0;

  // Close the WebSocket connection if it exists
  if (sicSocket) {
    sicSocket.close();
    sicSocket = null;
  }

  isConnecting = false;
};

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
  ircSendRawMessage('LIST');
};

export const ircSendNamesXProto = (): void => {
  ircSendRawMessage('PROTOCTL NAMESX');
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

export const ircRequestMetadata = (): void => {
  ircSendRawMessage('METADATA * SUB avatar status bot homepage display-name bot-url color');
};

export const ircRequestMetadataList = (nick: string): void => {
  ircSendRawMessage(`METADATA ${nick} LIST`, true);
};

export const ircSendRawMessage = (data: string, queue?: boolean): void => {
  if (data.length === 0) {
    return;
  }

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
  const socket = getSocket();
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: 'sic-client-event', data: message }));
  } else {
    console.warn('WebSocket is not connected. Message not sent:', message);
  }
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
  const socket = getSocket();
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: 'sic-client-event', data: message }));
  }
}, 300);
