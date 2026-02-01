import { websocketHost, websocketPort, encryptionKey, gatewayHost, gatewayPort, gatewayPath, isGatewayMode } from '@/config/config';
import { type Server, type ConnectionType } from './servers';
import { parseServer } from './helpers';
import { resetCapabilityState, isCapabilityEnabled } from './capabilities';
import { setSaslCredentials, resetSaslState, clearSaslCredentials } from './sasl';
import { setCurrentConnectionInfo, resetSTSSessionState } from './sts';
import { getSTSPolicy, hasValidSTSPolicy } from './store/stsStore';
import { setAddMessageToAllChannels } from '@features/channels/store/channels';
import { v4 as uuidv4 } from 'uuid';
import { MessageCategory } from '@shared/types';
import i18next from '@/app/i18n';
import { initEncryption, encryptMessage, decryptMessage, isEncryptionAvailable } from '@/network/encryption';
import {
  initDirectWebSocket,
  sendDirectRaw,
  isDirectConnected,
  isDirectConnecting,
  disconnectDirect,
  setDirectEventCallback,
} from './directWebSocket';

// Native WebSocket connection
let sicSocket: WebSocket | null = null;
let isConnecting = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventHandlers: Record<string, ((data: any) => void)[]> = {};

// Current connection mode: 'backend' for proxy connection, 'websocket' for direct connection
let currentConnectionMode: ConnectionType = 'backend';

// Inactivity timeout - show disconnection message after 120 seconds of no activity
const INACTIVITY_TIMEOUT_MS = 120 * 1000;
let inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;

const showDisconnectionMessage = (): void => {
  setAddMessageToAllChannels({
    id: uuidv4(),
    message: i18next.t('kernel.inactivityTimeout'),
    time: new Date().toISOString(),
    category: MessageCategory.error,
  });
};

const resetInactivityTimeout = (): void => {
  if (inactivityTimeoutId !== null) {
    clearTimeout(inactivityTimeoutId);
  }
  inactivityTimeoutId = setTimeout(showDisconnectionMessage, INACTIVITY_TIMEOUT_MS);
};

const clearInactivityTimeout = (): void => {
  if (inactivityTimeoutId !== null) {
    clearTimeout(inactivityTimeoutId);
    inactivityTimeoutId = null;
  }
};

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

  // Determine WebSocket URL based on gateway mode
  let wsUrl: string;
  if (isGatewayMode()) {
    // Gateway mode: connect to public gateway without encryption
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${gatewayHost}:${gatewayPort}${gatewayPath}`;
    console.log('Gateway mode: connecting to', wsUrl);
  } else {
    // Local mode: connect to local network backend with encryption
    wsUrl = `ws://${websocketHost}:${websocketPort}/SimpleIrcClient`;
  }

  sicSocket = new WebSocket(wsUrl);

  sicSocket.onopen = async () => {
    isConnecting = false;
    console.log('WebSocket connected');

    // Only enable encryption in non-gateway mode
    if (!isGatewayMode() && encryptionKey) {
      await initEncryption(encryptionKey);
      console.log('Encryption enabled');
    }

    resetInactivityTimeout();
    triggerEvent('connect', {});
  };

  sicSocket.onmessage = async (event) => {
    resetInactivityTimeout();
    try {
      let data: { event?: string; data?: unknown };
      if (isEncryptionAvailable()) {
        data = (await decryptMessage(event.data as string)) as { event?: string; data?: unknown };
      } else {
        data = JSON.parse(event.data as string) as { event?: string; data?: unknown };
      }
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
    clearInactivityTimeout();
    console.log('WebSocket disconnected');
    // Trigger as sic-irc-event so the kernel receives it and handles STS reconnection
    triggerEvent('sic-irc-event', { type: 'close' });
    sicSocket = null;
  };

  return sicSocket;
};

// Event handler management
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const triggerEvent = (eventName: string, data: any) => {
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
  if (currentConnectionMode === 'websocket') {
    return isDirectConnected();
  }
  return sicSocket !== null && sicSocket.readyState === WebSocket.OPEN;
};

export const isWebSocketConnecting = (): boolean => {
  if (currentConnectionMode === 'websocket') {
    return isDirectConnecting();
  }
  return isConnecting || (sicSocket !== null && sicSocket.readyState === WebSocket.CONNECTING);
};

export const ircDisconnect = (): void => {
  // Clear the message queue
  queueIrcMessages.length = 0;

  // Clear inactivity timeout
  clearInactivityTimeout();

  // Reset IRCv3 state
  resetCapabilityState();
  resetSaslState();
  clearSaslCredentials();
  resetSTSSessionState();

  // Handle direct WebSocket mode
  if (currentConnectionMode === 'websocket') {
    disconnectDirect();
    currentConnectionMode = 'backend'; // Reset so WizardInit works correctly
    return;
  }

  // In gateway mode, send disconnect command but keep WebSocket open
  if (isGatewayMode()) {
    ircSendDisconnectCommand();
    isConnecting = false;
    return;
  }

  // In local mode, close the WebSocket connection
  if (sicSocket) {
    sicSocket.close();
    sicSocket = null;
  }

  isConnecting = false;
};

/**
 * Send a disconnect command to the backend without closing the WebSocket.
 * Used for STS upgrades where we need to gracefully close the IRC connection
 * but keep the WebSocket open for immediate reconnection.
 * @param reason - Optional quit reason
 */
export const ircSendDisconnectCommand = (reason?: string): void => {
  const command = {
    type: 'disconnect',
    event: {
      quitReason: reason,
    },
  };
  sendMessage(command);
};

const queueIrcMessages: unknown[] = [];

export const ircConnect = (currentServer: Server, nick: string): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer?.host === undefined || singleServer?.host === '') {
    throw new Error('Unable to connect to IRC network - server host is empty');
  }

  const host = singleServer.host;
  const useTLS = singleServer.tls ?? false;

  // Check if this is a direct WebSocket connection
  if (currentServer.connectionType === 'websocket') {
    currentConnectionMode = 'websocket';
    // Set up the event callback so direct WebSocket can trigger events
    setDirectEventCallback(triggerEvent);
    // Track connection TLS status
    setCurrentConnectionInfo(host, useTLS);
    initDirectWebSocket(currentServer, nick);
    return;
  }

  // Backend proxy connection
  currentConnectionMode = 'backend';

  // Check for existing STS policy (only if not already using TLS)
  if (!useTLS && hasValidSTSPolicy(host)) {
    const policy = getSTSPolicy(host);
    if (policy) {
      // Connect with TLS using stored policy
      setCurrentConnectionInfo(host, true);
      ircConnectWithTLS(currentServer, nick, policy.port);
      return;
    }
  }

  // Track connection TLS status
  setCurrentConnectionInfo(host, useTLS);

  const command = {
    type: 'connect',
    event: {
      nick,
      server: {
        host: singleServer.host,
        port: singleServer.port,
        encoding: currentServer?.encoding,
        tls: useTLS,
      },
    },
  };

  sendMessage(command);
};

/**
 * Connect to IRC server with TLS enabled.
 * Used for STS upgrades and when connecting to servers with known STS policies.
 * @param currentServer - Server configuration
 * @param nick - Nickname to use
 * @param port - Optional TLS port (overrides server port)
 */
export const ircConnectWithTLS = (currentServer: Server, nick: string, port?: number): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer?.host === undefined || singleServer?.host === '') {
    throw new Error('Unable to connect to IRC network - server host is empty');
  }

  // Track TLS connection
  setCurrentConnectionInfo(singleServer.host, true);

  const command = {
    type: 'connect',
    event: {
      nick,
      server: {
        host: singleServer.host,
        port: port ?? singleServer.port,
        encoding: currentServer?.encoding,
        tls: true,
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

  // Direct WebSocket mode: send raw IRC command without JSON wrapping
  if (currentConnectionMode === 'websocket') {
    // For direct WebSocket, we don't support queuing (yet)
    sendDirectRaw(data);
    return;
  }

  // Backend proxy mode: wrap in JSON command
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

const sendMessage = async (message: unknown): Promise<void> => {
  const socket = getSocket();
  if (socket.readyState === WebSocket.OPEN) {
    const payload = { event: 'sic-client-event', data: message };
    if (isEncryptionAvailable()) {
      socket.send(await encryptMessage(payload));
    } else {
      socket.send(JSON.stringify(payload));
    }
  } else {
    console.warn('WebSocket is not connected. Message not sent:', message);
  }
};

const sendQueueMessage = (message: unknown): void => {
  queueIrcMessages.push(message);
};

setInterval(async function networkSendQueueMessages() {
  if (queueIrcMessages.length === 0) {
    return;
  }

  const message = queueIrcMessages.pop();
  if (message === undefined) {
    return;
  }
  const socket = getSocket();
  if (socket.readyState === WebSocket.OPEN) {
    const payload = { event: 'sic-client-event', data: message };
    if (isEncryptionAvailable()) {
      socket.send(await encryptMessage(payload));
    } else {
      socket.send(JSON.stringify(payload));
    }
  }
}, 300);
