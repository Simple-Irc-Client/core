import { localBackendHost, localBackendPort, localBackendPath, encryptionKey, gatewayHost, gatewayPort, gatewayPath, isGatewayMode } from '@/config/config';
import { type Server } from './servers';
import { parseServer } from './helpers';
import { resetCapabilityState, isCapabilityEnabled } from './capabilities';
import { setSaslCredentials, resetSaslState, clearSaslCredentials, saveSaslCredentialsForReconnect, restoreSaslCredentials, clearSavedCredentials } from './sasl';
import { setCurrentConnectionInfo, resetSTSSessionState } from './sts';
import { getSTSPolicy, hasValidSTSPolicy } from './store/stsStore';
import { setAddMessageToAllChannels } from '@features/channels/store/channels';
import { getServer, getCurrentNick, setIsConnected, setIsConnecting } from '@features/settings/store/settings';
import { v4 as uuidv4 } from 'uuid';
import { MessageCategory } from '@shared/types';
import i18next from '@/app/i18n';
import { initEncryption } from '@/network/encryption';
import {
  initDirectWebSocket,
  sendDirectRaw,
  isDirectConnected,
  isDirectConnecting,
  disconnectDirect,
  setDirectEventCallback,
  setDirectEncryption,
} from './directWebSocket';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventHandlers: Record<string, ((data: any) => void)[]> = {};

// Inactivity timeout - show disconnection message after 180 seconds of no activity
const INACTIVITY_TIMEOUT_MS = 180 * 1000;
let inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Reconnection retry tracking
const MAX_INACTIVITY_RECONNECT_RETRIES = 3;
let inactivityReconnectRetries = 0;

export const resetInactivityReconnectRetries = (): void => {
  inactivityReconnectRetries = 0;
};

const handleInactivityTimeout = async (): Promise<void> => {
  // Save credentials before disconnect (encrypted)
  await saveSaslCredentialsForReconnect();

  // Disconnect (but credentials are saved)
  disconnectDirect();
  setIsConnecting(false);
  setIsConnected(false);

  // Check if we can retry
  if (inactivityReconnectRetries < MAX_INACTIVITY_RECONNECT_RETRIES) {
    inactivityReconnectRetries++;

    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.inactivityTimeoutReconnecting', {
        attempt: inactivityReconnectRetries,
        max: MAX_INACTIVITY_RECONNECT_RETRIES,
      }),
      time: new Date().toISOString(),
      category: MessageCategory.info,
    });

    // Attempt reconnect after brief delay
    setTimeout(() => {
      void ircReconnect();
    }, 2000);
  } else {
    // Max retries reached - clear saved credentials
    clearSavedCredentials();
    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.inactivityTimeoutMaxRetries'),
      time: new Date().toISOString(),
      category: MessageCategory.error,
    });
  }
};

const resetInactivityTimeout = (): void => {
  if (inactivityTimeoutId !== null) {
    clearTimeout(inactivityTimeoutId);
  }
  inactivityTimeoutId = setTimeout(() => {
    void handleInactivityTimeout();
  }, INACTIVITY_TIMEOUT_MS);
};

const clearInactivityTimeout = (): void => {
  if (inactivityTimeoutId !== null) {
    clearTimeout(inactivityTimeoutId);
    inactivityTimeoutId = null;
  }
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

export const isConnected = (): boolean => {
  return isDirectConnected();
};

export const isWebSocketConnecting = (): boolean => {
  return isDirectConnecting();
};

export const ircDisconnect = (): void => {
  // Clear inactivity timeout
  clearInactivityTimeout();

  // Reset IRCv3 state
  resetCapabilityState();
  resetSaslState();
  clearSaslCredentials();
  resetSTSSessionState();

  // Disconnect direct WebSocket (server/backend handles QUIT)
  disconnectDirect();
};

export const ircConnect = (currentServer: Server, nick: string): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer?.host === undefined || singleServer?.host === '') {
    throw new Error('Unable to connect to IRC network - server host is empty');
  }

  const host = singleServer.host;
  const useTLS = singleServer.tls ?? false;

  // Check if this is a direct WebSocket connection (e.g., Ergo Chat)
  if (currentServer.connectionType === 'websocket') {
    setDirectEventCallback(triggerEvent);
    setDirectEncryption(false); // No encryption for direct WebSocket to IRC servers
    setCurrentConnectionInfo(host, useTLS);
    initDirectWebSocket(currentServer, nick);
    return;
  }

  // Gateway mode: use direct IRC protocol with gateway proxy
  if (isGatewayMode()) {
    setDirectEventCallback(triggerEvent);
    setDirectEncryption(false); // No encryption for gateway mode
    setCurrentConnectionInfo(host, useTLS);

    // Construct gateway WebSocket URL with query parameters
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      host: singleServer.host,
      port: String(singleServer.port),
      tls: String(useTLS),
      encoding: currentServer?.encoding ?? 'utf8',
    });
    const gatewayWebSocketUrl = `${protocol}//${gatewayHost}:${gatewayPort}${gatewayPath}?${params.toString()}`;

    const gatewayServer: Server = {
      ...currentServer,
      connectionType: 'websocket',
      websocketUrl: gatewayWebSocketUrl,
    };

    initDirectWebSocket(gatewayServer, nick);
    return;
  }

  // Local backend mode: use direct IRC protocol with encryption
  setDirectEventCallback(triggerEvent);

  // Check for existing STS policy (only if not already using TLS)
  let effectiveTLS = useTLS;
  let effectivePort = singleServer.port;
  if (!useTLS && hasValidSTSPolicy(host)) {
    const policy = getSTSPolicy(host);
    if (policy) {
      effectiveTLS = true;
      effectivePort = policy.port;
      setCurrentConnectionInfo(host, true);
    }
  }

  setCurrentConnectionInfo(host, effectiveTLS);

  // Initialize encryption for local backend
  if (encryptionKey) {
    initEncryption(encryptionKey).then(() => {
      setDirectEncryption(true);
      console.log('Encryption enabled for local backend');
      connectToLocalBackend();
    });
  } else {
    setDirectEncryption(false);
    connectToLocalBackend();
  }

  function connectToLocalBackend() {
    const params = new URLSearchParams({
      host,
      port: String(effectivePort),
      tls: String(effectiveTLS),
      encoding: currentServer?.encoding ?? 'utf8',
    });
    const backendWebSocketUrl = `ws://${localBackendHost}:${localBackendPort}/${localBackendPath}?${params.toString()}`;

    const backendServer: Server = {
      ...currentServer,
      connectionType: 'websocket',
      websocketUrl: backendWebSocketUrl,
    };

    initDirectWebSocket(backendServer, nick);
  }
};

/**
 * Connect to IRC server with TLS enabled.
 * Used for STS upgrades and when connecting to servers with known STS policies.
 */
export const ircConnectWithTLS = (currentServer: Server, nick: string, port?: number): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer?.host === undefined || singleServer?.host === '') {
    throw new Error('Unable to connect to IRC network - server host is empty');
  }

  const tlsServer: Server = {
    ...currentServer,
    tls: true,
  };

  if (port !== undefined) {
    tlsServer.servers = [`${singleServer.host}:${port}`];
  }

  ircConnect(tlsServer, nick);
};

/**
 * Store credentials for SASL authentication during CAP negotiation.
 */
export const ircSetSaslCredentials = (account: string, password: string): void => {
  setSaslCredentials(account, password);
};

/**
 * Send password to authenticate with NickServ (fallback when SASL is not available).
 * Also stores credentials for potential reconnection.
 */
export const ircSendPassword = (password: string): void => {
  // Store credentials for potential reconnect (use current nick as account)
  const account = getCurrentNick();
  if (account) {
    setSaslCredentials(account, password);
  }
  ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${password}`);
};

/**
 * Authenticate using either SASL (if available) or NickServ fallback.
 * Also stores credentials for potential reconnection.
 */
export const ircAuthenticate = (account: string, password: string): void => {
  // Store credentials for potential reconnect
  setSaslCredentials(account, password);
  if (isCapabilityEnabled('sasl')) {
    console.warn('SASL enabled but authentication requested post-connect, falling back to NickServ');
    ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${account} ${password}`);
  } else {
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
  ircSendRawMessage(`METADATA ${nick} GET ${item}`);
};

export const ircRequestMetadata = (): void => {
  ircSendRawMessage('METADATA * SUB avatar status bot homepage display-name bot-url color');
};

export const ircRequestMetadataList = (nick: string): void => {
  ircSendRawMessage(`METADATA ${nick} LIST`);
};

/**
 * Request chat history for a target (channel or user)
 * https://ircv3.net/specs/extensions/chathistory
 */
export const ircRequestChatHistory = (
  target: string,
  subcommand: 'LATEST' | 'BEFORE' | 'AFTER' | 'AROUND' = 'LATEST',
  timestamp?: string,
  limit = 50,
): void => {
  if (subcommand === 'LATEST') {
    ircSendRawMessage(`CHATHISTORY LATEST ${target} * ${limit}`);
  } else if (timestamp) {
    ircSendRawMessage(`CHATHISTORY ${subcommand} ${target} timestamp=${timestamp} ${limit}`);
  }
};

/**
 * Request chat history between two timestamps
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
 */
export const ircMonitorAdd = (nicks: string[]): void => {
  if (nicks.length === 0) return;
  ircSendRawMessage(`MONITOR + ${nicks.join(',')}`);
};

/**
 * Remove nicks from the MONITOR list
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

export const ircSendRawMessage = (data: string): void => {
  if (data.length === 0) {
    return;
  }
  sendDirectRaw(data);
};

/**
 * Reconnect to IRC server preserving SASL credentials.
 * Used for automatic reconnection after inactivity timeout.
 */
export const ircReconnect = async (): Promise<boolean> => {
  const server = getServer();
  const nick = getCurrentNick();

  if (server === undefined || nick === '') {
    return false;
  }

  // Reset state without clearing saved credentials
  clearInactivityTimeout();
  resetCapabilityState();
  resetSaslState();
  // Note: clearSaslCredentials() NOT called - credentials restored below
  resetSTSSessionState();
  disconnectDirect();

  // Restore saved credentials for SASL re-authentication (decrypted)
  await restoreSaslCredentials();

  // Reconnect
  ircConnect(server, nick);
  return true;
};

// Re-export for backward compatibility with tests and other modules
export { resetInactivityTimeout, clearInactivityTimeout, clearSavedCredentials };
