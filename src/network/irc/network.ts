import { websocketHost, websocketPort } from '@/config/config';
import { type Server } from './servers';
import { parseServer } from './helpers';
import { resetCapabilityState, isCapabilityEnabled } from './capabilities';
import { setSaslCredentials, resetSaslState, clearSaslCredentials } from './sasl';

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

  // Reset IRCv3 state
  resetCapabilityState();
  resetSaslState();
  clearSaslCredentials();

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

/**
 * Store credentials for SASL authentication during CAP negotiation.
 * Call this before connecting to enable SASL auth.
 * @param account - The account name (usually same as nick)
 * @param password - The account password
 */
export const ircSetSaslCredentials = (account: string, password: string): void => {
  setSaslCredentials(account, password);
};

/**
 * Send password to authenticate with NickServ.
 * This is used as a fallback when SASL is not available.
 * @param password - The account password
 */
export const ircSendPassword = (password: string): void => {
  // Use NickServ IDENTIFY as fallback when SASL is not available
  ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${password}`);
};

/**
 * Authenticate using either SASL (if available) or NickServ fallback.
 * @param account - The account name
 * @param password - The account password
 */
export const ircAuthenticate = (account: string, password: string): void => {
  if (isCapabilityEnabled('sasl')) {
    // SASL should have already authenticated during CAP negotiation
    // If we get here, something went wrong - try NickServ
    console.warn('SASL enabled but authentication requested post-connect, falling back to NickServ');
    ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${account} ${password}`);
  } else {
    // No SASL, use NickServ
    ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${account} ${password}`);
  }
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

/**
 * Request chat history for a target (channel or user)
 * https://ircv3.net/specs/extensions/chathistory
 *
 * @param target - Channel or nick to get history for
 * @param subcommand - LATEST, BEFORE, AFTER, AROUND, BETWEEN
 * @param timestamp - Reference timestamp (ISO 8601 or msgid)
 * @param limit - Maximum number of messages to return
 */
export const ircRequestChatHistory = (
  target: string,
  subcommand: 'LATEST' | 'BEFORE' | 'AFTER' | 'AROUND' = 'LATEST',
  timestamp?: string,
  limit = 50,
): void => {
  if (subcommand === 'LATEST') {
    // CHATHISTORY LATEST <target> * <limit>
    ircSendRawMessage(`CHATHISTORY LATEST ${target} * ${limit}`);
  } else if (timestamp) {
    // CHATHISTORY BEFORE/AFTER/AROUND <target> timestamp=<ts> <limit>
    ircSendRawMessage(`CHATHISTORY ${subcommand} ${target} timestamp=${timestamp} ${limit}`);
  }
};

/**
 * Request chat history between two timestamps
 * @param target - Channel or nick
 * @param startTime - Start timestamp (ISO 8601)
 * @param endTime - End timestamp (ISO 8601)
 * @param limit - Maximum number of messages
 */
export const ircRequestChatHistoryBetween = (
  target: string,
  startTime: string,
  endTime: string,
  limit = 50,
): void => {
  ircSendRawMessage(`CHATHISTORY BETWEEN ${target} timestamp=${startTime} timestamp=${endTime} ${limit}`);
};

/**
 * Request available chat history targets
 */
export const ircRequestChatHistoryTargets = (timestamp?: string, limit = 50): void => {
  if (timestamp) {
    ircSendRawMessage(`CHATHISTORY TARGETS timestamp=${timestamp} ${limit}`);
  } else {
    ircSendRawMessage(`CHATHISTORY TARGETS * ${limit}`);
  }
};

/**
 * Add nicks to the MONITOR list
 * https://ircv3.net/specs/extensions/monitor.html
 * @param nicks - Array of nicks to monitor
 */
export const ircMonitorAdd = (nicks: string[]): void => {
  if (nicks.length === 0) return;
  ircSendRawMessage(`MONITOR + ${nicks.join(',')}`);
};

/**
 * Remove nicks from the MONITOR list
 * @param nicks - Array of nicks to stop monitoring
 */
export const ircMonitorRemove = (nicks: string[]): void => {
  if (nicks.length === 0) return;
  ircSendRawMessage(`MONITOR - ${nicks.join(',')}`);
};

/**
 * Clear the entire MONITOR list
 */
export const ircMonitorClear = (): void => {
  ircSendRawMessage('MONITOR C');
};

/**
 * Request the current MONITOR list
 */
export const ircMonitorList = (): void => {
  ircSendRawMessage('MONITOR L');
};

/**
 * Request status of all monitored nicks
 */
export const ircMonitorStatus = (): void => {
  ircSendRawMessage('MONITOR S');
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
