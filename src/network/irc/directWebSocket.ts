import { type Server } from './servers';
import { parseServer } from './helpers';
import { encryptString, decryptString, isEncryptionAvailable } from '@/network/encryption';

let directSocket: WebSocket | null = null;
let isDirectConnectingFlag = false;

let useEncryption = false;

// Sequential, so async decryption can't reorder lines
let messageQueue: string[] = [];
let isProcessingQueue = false;

let eventCallback: ((eventName: string, data: unknown) => void) | null = null;

export const setDirectEncryption = (enabled: boolean): void => {
  useEncryption = enabled;
};

export const setDirectEventCallback = (callback: (eventName: string, data: unknown) => void): void => {
  eventCallback = callback;
};

const triggerDirectEvent = (eventName: string, data: unknown): void => {
  if (eventCallback) {
    eventCallback(eventName, data);
  }
};

const processMessageQueue = async (): Promise<void> => {
  if (isProcessingQueue) { return; }
  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    let data = messageQueue.shift() as string;

    if (useEncryption && isEncryptionAvailable()) {
      try {
        data = await decryptString(data);
      } catch (err) {
        console.error('Failed to decrypt WebSocket message:', err);
        continue;
      }
    }

    const lines = data.split(/\r?\n/).filter((line) => line.length > 0);
    for (const line of lines) {
      handleIrcMessage(line);
    }
  }

  isProcessingQueue = false;
};

export const initDirectWebSocket = (server: Server): void => {
  // Handlers removed first so a stale onclose can't null the new socket
  if (directSocket) {
    directSocket.onclose = null;
    directSocket.onerror = null;
    directSocket.onmessage = null;
    directSocket.onopen = null;
    directSocket.close();
    directSocket = null;
  }

  if (isDirectConnectingFlag) {
    throw new Error('Direct WebSocket connection already in progress');
  }

  isDirectConnectingFlag = true;

  const parsedServer = parseServer(server);
  if (!parsedServer?.host) {
    isDirectConnectingFlag = false;
    throw new Error('Unable to connect - server host is empty');
  }

  let wsUrl: string;
  if (server.websocketUrl) {
    wsUrl = server.websocketUrl;
  } else {
    const protocol = server.tls ? 'wss:' : 'ws:';
    const port = parsedServer.port ?? (server.tls ? 443 : 80);
    wsUrl = `${protocol}//${parsedServer.host}:${port}`;
  }

  if (import.meta.env.DEV) {
    console.log('Direct WebSocket: connecting to', wsUrl);
  }
  directSocket = new WebSocket(wsUrl);

  directSocket.onopen = () => {
    isDirectConnectingFlag = false;
    if (import.meta.env.DEV) {
      console.log('Direct WebSocket connected');
    }

    // The kernel registers on this; a bare 'connect' event name has no subscriber
    triggerDirectEvent('sic-irc-event', { type: 'connect' });
  };

  directSocket.onmessage = (event) => {
    messageQueue.push(event.data as string);
    void processMessageQueue();
  };

  directSocket.onerror = (error) => {
    isDirectConnectingFlag = false;
    if (import.meta.env.DEV) {
      console.error('Direct WebSocket error:', error);
    }
    // Browser WebSocket errors carry no detail; a close event follows
    triggerDirectEvent('sic-irc-event', { type: 'error', line: 'WebSocket connection error' });
  };

  directSocket.onclose = () => {
    isDirectConnectingFlag = false;
    if (import.meta.env.DEV) {
      console.log('Direct WebSocket disconnected');
    }
    triggerDirectEvent('sic-irc-event', { type: 'close' });
    directSocket = null;
  };
};

const handleIrcMessage = (line: string): void => {
  triggerDirectEvent('sic-irc-event', { type: 'raw', line });
};

/** No trailing \n: WebSocket messages are discrete. */
export const sendDirectRaw = async (data: string): Promise<void> => {
  if (!directSocket || directSocket.readyState !== WebSocket.OPEN) {
    if (import.meta.env.DEV) {
      console.warn('Direct WebSocket not connected. Message not sent.');
    }
    return;
  }

  if (useEncryption && isEncryptionAvailable()) {
    const encrypted = await encryptString(data);
    directSocket.send(encrypted);
  } else {
    directSocket.send(data);
  }
};

export const isDirectConnected = (): boolean => {
  return directSocket !== null && directSocket.readyState === WebSocket.OPEN;
};

export const isDirectConnecting = (): boolean => {
  return isDirectConnectingFlag || (directSocket !== null && directSocket.readyState === WebSocket.CONNECTING);
};

export const disconnectDirect = (): void => {
  if (directSocket) {
    // No stale close/error events mid-reconnect
    directSocket.onclose = null;
    directSocket.onerror = null;
    directSocket.onmessage = null;
    directSocket.onopen = null;
    directSocket.close();
    directSocket = null;
  }
  isDirectConnectingFlag = false;
  useEncryption = false;
  messageQueue = [];
  isProcessingQueue = false;
};
