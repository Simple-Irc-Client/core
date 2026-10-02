import { localBackendHost, localBackendPort, localBackendPath, encryptionKey, gatewayHost, gatewayPort, gatewayPath, isGatewayMode } from '@/config/config';
import { type Server } from './servers';
import { parseServer } from './helpers';
import { resetCapabilityState, isCapabilityEnabled } from './capabilities';
import { setSaslCredentials, resetSaslState, clearSaslCredentials, saveSaslCredentialsForReconnect, restoreSaslCredentials, clearSavedCredentials } from './sasl';
import { setCurrentConnectionInfo, resetSTSSessionState } from './sts';
import { getSTSPolicy, hasValidSTSPolicy } from './store/stsStore';
import { setAddMessageToAllChannels, clearAllTyping } from '@features/channels/store/channels';
import { getServer, getCurrentChannelName, getCurrentNick, setNick, setIsConnected, setIsConnecting, getEncryptedPassword, getPasswordNick, getLineLenLimit } from '@features/settings/store/settings';
import { v4 as uuidv4 } from 'uuid';
import { MessageCategory } from '@shared/types';
import { MessageColor } from '@/config/theme';
import i18next from '@/app/i18n';
import { initEncryption, decryptPersistent } from '@/network/encryption';
import {
  initDirectWebSocket,
  sendDirectRaw,
  isDirectConnected,
  isDirectConnecting,
  disconnectDirect,
  setDirectEventCallback,
  setDirectEncryption,
} from './transport';
import { clearAllBatches } from './batch';
import { clearLabels, createLabel, type LabeledRequest } from './labels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventHandlers: Record<string, ((data: any) => void)[]> = {};

// No inbound data for this long = dead. Tight is safe: the keepalive's PONG arrives every ~30s
const INACTIVITY_TIMEOUT_MS = 120 * 1000;
let inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Our own PING, so liveness doesn't depend on the server's ping cadence (covers both transports)
const KEEPALIVE_INTERVAL_MS = 30 * 1000;
let keepaliveTimerId: ReturnType<typeof setInterval> | null = null;

const stopKeepalive = (): void => {
  if (keepaliveTimerId !== null) {
    clearInterval(keepaliveTimerId);
    keepaliveTimerId = null;
  }
};

const startKeepalive = (): void => {
  stopKeepalive();
  // Immediately, so the lag indicator has a reading right after connect
  ircSendRawMessage(`PING :${Date.now()}`);
  keepaliveTimerId = setInterval(() => {
    ircSendRawMessage(`PING :${Date.now()}`);
  }, KEEPALIVE_INTERVAL_MS);
};

const MAX_INACTIVITY_RECONNECT_RETRIES = 3;
let inactivityReconnectRetries = 0;
let isReconnecting = false;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const getIsReconnecting = (): boolean => isReconnecting;

const cancelReconnect = (): void => {
  isReconnecting = false;
  if (reconnectTimeoutId !== null) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
};

export const resetInactivityReconnectRetries = (): void => {
  inactivityReconnectRetries = 0;
  cancelReconnect();
};

const scheduleReconnectAttempt = (): void => {
  if (inactivityReconnectRetries >= MAX_INACTIVITY_RECONNECT_RETRIES) {
    // Retries exhausted
    isReconnecting = false;
    clearSavedCredentials();
    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.inactivityTimeoutMaxRetries'),
      time: new Date().toISOString(),
      category: MessageCategory.error,
    });
    return;
  }

  inactivityReconnectRetries++;

  setAddMessageToAllChannels({
    id: uuidv4(),
    message: i18next.t('kernel.inactivityTimeoutReconnecting', {
      attempt: inactivityReconnectRetries,
      max: MAX_INACTIVITY_RECONNECT_RETRIES,
    }),
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    // The attempt-counter message above already announces it
    void ircReconnect({ announce: false }).then((success) => {
      if (!success) {
        // No server/nick to reconnect with
        scheduleReconnectAttempt();
      }
    }).catch(() => {
      // e.g. invalid server config
      scheduleReconnectAttempt();
    });
  }, 2000);
};

/** The kernel saw a close during a reconnect cycle: that attempt failed. */
export const handleReconnectFailure = (): void => {
  if (!isReconnecting) { return; }

  if (reconnectTimeoutId !== null) { return; }

  setIsConnecting(false);
  scheduleReconnectAttempt();
};

const handleInactivityTimeout = async (): Promise<void> => {
  await saveSaslCredentialsForReconnect();

  stopKeepalive();

  // Silently: no stale 'close' reaches the kernel mid-reconnect
  disconnectDirect();
  notifyConnectionTornDown();
  setIsConnecting(false);
  setIsConnected(false);
  clearAllTyping();

  isReconnecting = true;
  scheduleReconnectAttempt();
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

// Notified on every teardown, including the self-initiated ones (ircDisconnect, ircReconnect, inactivity)
// whose disconnectDirect() hides the close event from the kernel. For per-connection state like E2EE sessions
const connectionTornDownListeners: (() => void)[] = [];

export const onConnectionTornDown = (listener: () => void): void => {
  connectionTornDownListeners.push(listener);
};

const notifyConnectionTornDown = (): void => {
  for (const listener of connectionTornDownListeners) {
    listener();
  }
};

export const isConnected = (): boolean => {
  return isDirectConnected();
};

export const isWebSocketConnecting = (): boolean => {
  return isDirectConnecting();
};

export const ircDisconnect = (): void => {
  clearInactivityTimeout();
  stopKeepalive();
  cancelReconnect();

  resetCapabilityState();
  resetSaslState();
  clearSaslCredentials();
  resetSTSSessionState();

  disconnectDirect();
  notifyConnectionTornDown();
};

export const ircConnect = (currentServer: Server, nick: string): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer.host === undefined || singleServer.host === '') {
    throw new Error('Unable to connect to IRC network - server host is empty');
  }

  // The kernel reads NICK/USER from the store at connect time
  setNick(nick);

  const host = singleServer.host;
  const useTLS = singleServer.tls ?? false;

  // e.g. Ergo
  if (currentServer.connectionType === 'websocket') {
    setDirectEventCallback(triggerEvent);
    setDirectEncryption(false); // No encryption for direct WebSocket to IRC servers
    setCurrentConnectionInfo(host, useTLS);
    initDirectWebSocket(currentServer);
    return;
  }

  if (isGatewayMode()) {
    setDirectEventCallback(triggerEvent);
    setDirectEncryption(false); // No encryption for gateway mode
    setCurrentConnectionInfo(host, useTLS);

    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      host: singleServer.host,
      port: String(singleServer.port),
      tls: String(useTLS),
      encoding: currentServer.encoding ?? 'utf8',
    });
    const gatewayWebSocketUrl = `${protocol}//${gatewayHost}:${gatewayPort}${gatewayPath}?${params.toString()}`;

    const gatewayServer: Server = {
      ...currentServer,
      connectionType: 'websocket',
      websocketUrl: gatewayWebSocketUrl,
    };

    initDirectWebSocket(gatewayServer);
    return;
  }

  setDirectEventCallback(triggerEvent);

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

  if (encryptionKey) {
    initEncryption(encryptionKey).then(() => {
      setDirectEncryption(true);
      if (import.meta.env.DEV) { console.log('Encryption enabled for local backend'); }
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
      encoding: currentServer.encoding ?? 'utf8',
    });
    const backendWebSocketUrl = `ws://${localBackendHost}:${localBackendPort}/${localBackendPath}?${params.toString()}`;

    const backendServer: Server = {
      ...currentServer,
      connectionType: 'websocket',
      websocketUrl: backendWebSocketUrl,
    };

    initDirectWebSocket(backendServer);
  }
};

/** For STS upgrades and servers with a known STS policy. */
export const ircConnectWithTLS = (currentServer: Server, nick: string, port?: number): void => {
  const singleServer = parseServer(currentServer);
  if (singleServer == null || singleServer.host === undefined || singleServer.host === '') {
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

export const ircSetSaslCredentials = (account: string, password: string): void => {
  setSaslCredentials(account, password);
};

/** NickServ fallback when SASL isn't available. */
export const ircSendPassword = (password: string): void => {
  const account = getCurrentNick();
  if (account) {
    setSaslCredentials(account, password);
  }
  ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${password}`);
};

export const ircAuthenticate = (account: string, password: string): void => {
  setSaslCredentials(account, password);
  if (isCapabilityEnabled('sasl')) {
    if (import.meta.env.DEV) { console.warn('SASL enabled but authentication requested post-connect, falling back to NickServ'); }
  }
  ircSendRawMessage(`PRIVMSG NickServ :IDENTIFY ${account} ${password}`);
};

export const ircSendList = (): void => {
  ircSendRawMessage('LIST');
};

export const ircSendAlisListRequest = (): void => {
  ircSendRawMessage('SQUERY Alis :LIST #* -min 2');
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
  ircSendRawMessage('METADATA * SUB avatar status bot homepage display-name color');
};

export const ircRequestMetadataList = (nick: string): void => {
  ircSendRawMessage(`METADATA ${nick} LIST`);
};

// https://ircv3.net/specs/extensions/chathistory
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

export const ircRequestChatHistoryBetween = (
  target: string,
  startTime: string,
  endTime: string,
  limit = 50,
): void => {
  ircSendRawMessage(`CHATHISTORY BETWEEN ${target} timestamp=${startTime} timestamp=${endTime} ${limit}`);
};

export const ircRequestChatHistoryTargets = (timestamp?: string, limit = 50): void => {
  if (timestamp) {
    ircSendRawMessage(`CHATHISTORY TARGETS timestamp=${timestamp} ${limit}`);
  } else {
    ircSendRawMessage(`CHATHISTORY TARGETS * ${limit}`);
  }
};

// https://ircv3.net/specs/extensions/monitor.html
export const ircMonitorAdd = (nicks: string[]): void => {
  if (nicks.length === 0) { return; }
  ircSendRawMessage(`MONITOR + ${nicks.join(',')}`);
};

export const ircMonitorRemove = (nicks: string[]): void => {
  if (nicks.length === 0) { return; }
  ircSendRawMessage(`MONITOR - ${nicks.join(',')}`);
};

export const ircMonitorClear = (): void => {
  ircSendRawMessage('MONITOR C');
};

export const ircMonitorList = (): void => {
  ircSendRawMessage('MONITOR L');
};

export const ircMonitorStatus = (): void => {
  ircSendRawMessage('MONITOR S');
};

/** Pre-IRCv3 fallback for servers without MONITOR. */
export const ircWatchAdd = (nicks: string[]): void => {
  if (nicks.length === 0) { return; }
  ircSendRawMessage(`WATCH ${nicks.map((nick) => `+${nick}`).join(' ')}`);
};

export const ircWatchRemove = (nicks: string[]): void => {
  if (nicks.length === 0) { return; }
  ircSendRawMessage(`WATCH ${nicks.map((nick) => `-${nick}`).join(' ')}`);
};

// 512 incl. \r\n unless ISUPPORT LINELEN says otherwise. E2EE chunking derives from the same value, or chunks would be truncated
const DEFAULT_MAX_IRC_MESSAGE_LENGTH = 510;

const getMaxIrcMessageLength = (): number => getLineLenLimit() || DEFAULT_MAX_IRC_MESSAGE_LENGTH;

export const ircSendRawMessage = (data: string): void => {
  if (data.length === 0) {
    return;
  }
  // Tags have their own budget (message-tags); the line length limit applies to the rest
  const tagsLength = data.startsWith('@') ? data.indexOf(' ') + 1 : 0;
  const maxLength = tagsLength + getMaxIrcMessageLength();
  if (data.length > maxLength) {
    // Silent truncation hid data loss before; callers that can't be truncated must split up front
    console.warn(`IRC message exceeds ${maxLength} chars and will be truncated:`, `${data.slice(0, 80)}…`);
    sendDirectRaw(data.slice(0, maxLength));
    return;
  }
  sendDirectRaw(data);
};

/**
 * Sends a command whose replies belong to `request`: with labeled-response the server tags them with its label.
 * Returns whether it was labeled; without the capability the replies can't be told apart.
 */
export const ircSendCommand = (data: string, request: LabeledRequest): boolean => {
  if (data.length === 0 || !isCapabilityEnabled('labeled-response') || !isCapabilityEnabled('batch')) {
    ircSendRawMessage(data);
    return false;
  }

  const label = createLabel(request);
  ircSendRawMessage(data.startsWith('@') ? `@label=${label};${data.slice(1)}` : `@label=${label} ${data}`);
  return true;
};

/** A command the user issued from the window they are looking at; its replies go back there. */
export const ircSendUserCommand = (data: string): boolean => ircSendCommand(data, { window: getCurrentChannelName() });

let reconnectInFlight: Promise<boolean> | null = null;

/**
 * Preserves SASL credentials. Single-flight: overlapping calls (double click, watchdog racing network-back)
 * join the running one. `isConnecting` is raised before the first await so Connect buttons stay disabled.
 */
export const ircReconnect = (options: { announce?: boolean } = {}): Promise<boolean> => {
  if (reconnectInFlight !== null) {
    return reconnectInFlight;
  }
  reconnectInFlight = runReconnect(options).finally(() => {
    reconnectInFlight = null;
  });
  return reconnectInFlight;
};

const runReconnect = async ({ announce = true }: { announce?: boolean }): Promise<boolean> => {
  const server = getServer();
  const nick = getCurrentNick();

  if (server === undefined || nick === '') {
    return false;
  }

  setIsConnecting(true);
  try {
    await reconnectAs(server, nick, announce);
  } catch (err) {
    setIsConnecting(false);
    throw err;
  }
  return true;
};

const reconnectAs = async (server: Server, nick: string, announce: boolean): Promise<void> => {
  if (announce) {
    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.reconnecting'),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }

  // Keeps saved credentials
  clearInactivityTimeout();
  stopKeepalive();
  resetCapabilityState();
  resetSaslState();
  resetSTSSessionState();
  clearAllBatches();
  clearLabels();
  disconnectDirect();
  notifyConnectionTornDown();

  const restored = await restoreSaslCredentials();

  // Fall back to persistent storage
  if (!restored) {
    const encryptedPassword = getEncryptedPassword();
    const passwordNick = getPasswordNick();
    if (encryptedPassword && passwordNick === nick) {
      try {
        const password = await decryptPersistent(encryptedPassword);
        setSaslCredentials(nick, password);
      } catch {
        // Continue without credentials
      }
    }
  }

  ircConnect(server, nick);
};

// On `online`/tab-visible: mobile freezes the watchdog's timers in the background, so it can't be relied on
export const handleNetworkMaybeBack = (): void => {
  if (getServer() === undefined || getCurrentNick() === '') {
    return;
  }

  // Also guards back-to-back `online` + `visibilitychange`: isReconnecting is set synchronously below
  if (isReconnecting || isDirectConnecting()) {
    return;
  }

  // Possibly half-open after a network handoff: a PONG proves it, silence lets the watchdog time out
  if (isDirectConnected()) {
    ircSendRawMessage(`PING :${Date.now()}`);
    return;
  }

  resetInactivityReconnectRetries();
  isReconnecting = true;
  setIsConnecting(true);
  void ircReconnect()
    .then((started) => {
      if (!started) {
        isReconnecting = false;
        setIsConnecting(false);
      }
    })
    .catch(() => {
      isReconnecting = false;
      setIsConnecting(false);
    });
};

let reachabilityListenersBound = false;

const onNetworkOnline = (): void => {
  handleNetworkMaybeBack();
};

const onVisibilityChange = (): void => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    handleNetworkMaybeBack();
  }
};

export const startReachabilityWatch = (): void => {
  if (reachabilityListenersBound || typeof window === 'undefined') {
    return;
  }
  reachabilityListenersBound = true;
  window.addEventListener('online', onNetworkOnline);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
};

export const stopReachabilityWatch = (): void => {
  if (!reachabilityListenersBound) {
    return;
  }
  reachabilityListenersBound = false;
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onNetworkOnline);
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
};

/** With the saved password, when NickServ asks after the wizard is done. */
export const ircAutoAuthenticate = async (): Promise<boolean> => {
  const nick = getCurrentNick();
  const encryptedPassword = getEncryptedPassword();
  const passwordNick = getPasswordNick();

  if (!encryptedPassword || passwordNick !== nick) {
    return false;
  }

  try {
    const password = await decryptPersistent(encryptedPassword);
    ircSendPassword(password);
    return true;
  } catch {
    return false;
  }
};

export { resetInactivityTimeout, clearInactivityTimeout, startKeepalive, stopKeepalive, clearSavedCredentials, cancelReconnect };
