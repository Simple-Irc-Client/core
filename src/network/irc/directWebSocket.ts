import { type Server } from './servers';
import { parseServer } from './helpers';
import { encryptString, decryptString, isEncryptionAvailable } from '@/network/encryption';

// Direct WebSocket connection to IRC server (bypassing backend)
let directSocket: WebSocket | null = null;
let isDirectConnectingFlag = false;

// Encryption mode for local backend connections
let useEncryption = false;

// Sequential message processing queue (prevents out-of-order decryption)
let messageQueue: string[] = [];
let isProcessingQueue = false;

// Event callback for IRC events (set by network.ts)
let eventCallback: ((eventName: string, data: unknown) => void) | null = null;

/**
 * Enable or disable encryption for WebSocket messages.
 * Used for local backend connections that require encryption.
 */
export const setDirectEncryption = (enabled: boolean): void => {
  useEncryption = enabled;
};

/**
 * Set the event callback for IRC events.
 * This is called by network.ts to route events to the kernel.
 */
export const setDirectEventCallback = (callback: (eventName: string, data: unknown) => void): void => {
  eventCallback = callback;
};

/**
 * Trigger an event through the callback (if set)
 */
const triggerDirectEvent = (eventName: string, data: unknown): void => {
  if (eventCallback) {
    eventCallback(eventName, data);
  }
};

/**
 * Process queued WebSocket messages sequentially to preserve IRC message ordering.
 * When encryption is enabled, decryption is async and concurrent onmessage handlers
 * could complete out of order, causing protocol issues (e.g. END_OF_LIST before all
 * LIST entries are processed).
 */
const processMessageQueue = async (): Promise<void> => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    let data = messageQueue.shift() as string;

    if (useEncryption && isEncryptionAvailable()) {
      try {
        data = await decryptString(data);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Failed to decrypt WebSocket message:', err);
        }
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

/**
 * Initialize a direct WebSocket connection to an IRC server.
 * This bypasses the backend and connects directly from the browser.
 */
export const initDirectWebSocket = (server: Server, nick: string): void => {
  // Close existing connection if any
  if (directSocket) {
    directSocket.close();
    directSocket = null;
  }

  if (isDirectConnectingFlag) {
    throw new Error('Direct WebSocket connection already in progress');
  }

  isDirectConnectingFlag = true;
  hasReceivedWelcome = false;

  const parsedServer = parseServer(server);
  if (!parsedServer?.host) {
    isDirectConnectingFlag = false;
    throw new Error('Unable to connect - server host is empty');
  }

  // Determine WebSocket URL
  let wsUrl: string;
  if (server.websocketUrl) {
    wsUrl = server.websocketUrl;
  } else {
    // Construct WebSocket URL from server info
    const protocol = server.tls ? 'wss:' : 'ws:';
    const port = parsedServer.port ?? (server.tls ? 443 : 80);
    wsUrl = `${protocol}//${parsedServer.host}:${port}`;
  }

  if (import.meta.env.DEV) {
    console.log('Direct WebSocket: connecting to', wsUrl);
  }
  directSocket = new WebSocket(wsUrl);

  directSocket.onopen = async () => {
    isDirectConnectingFlag = false;
    if (import.meta.env.DEV) {
      console.log('Direct WebSocket connected');
    }

    // Send CAP LS to start capability negotiation
    await sendDirectRaw('CAP LS 302');

    // Send NICK and USER
    await sendDirectRaw(`NICK ${nick}`);
    await sendDirectRaw(`USER ${nick} 0 * :${nick}`);

    triggerDirectEvent('connect', {});
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
    triggerDirectEvent('error', error);
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

// Track if we've received RPL_WELCOME (001) to trigger 'connected' event
let hasReceivedWelcome = false;

/**
 * Handle an incoming IRC message line.
 * Sends it to the kernel as a raw event (kernel handles parsing).
 */
const handleIrcMessage = (line: string): void => {
  // Check for RPL_WELCOME (001) to trigger 'connected' event
  // This mirrors the backend behavior where 'connected' is sent after IRC registration completes
  if (!hasReceivedWelcome) {
    // Parse the command from the line
    // Format: [@tags] [:prefix] command params
    let workingLine = line;

    // Skip IRCv3 tags if present
    if (workingLine.startsWith('@')) {
      const spaceIndex = workingLine.indexOf(' ');
      if (spaceIndex !== -1) {
        workingLine = workingLine.substring(spaceIndex + 1);
      }
    }

    // Skip prefix if present
    if (workingLine.startsWith(':')) {
      const spaceIndex = workingLine.indexOf(' ');
      if (spaceIndex !== -1) {
        workingLine = workingLine.substring(spaceIndex + 1);
      }
    }

    // Get the command (first word)
    const command = workingLine.split(' ')[0];

    if (command === '001') {
      hasReceivedWelcome = true;
      triggerDirectEvent('sic-irc-event', { type: 'connected' });
    }
  }

  // Send raw line to kernel - it will parse using parseIrcRawMessage
  triggerDirectEvent('sic-irc-event', { type: 'raw', line });
};

/**
 * Send a raw IRC command over the direct WebSocket.
 * No \n is needed at the end (WebSocket messages are discrete).
 * If encryption is enabled, the message will be encrypted before sending.
 */
export const sendDirectRaw = async (data: string): Promise<void> => {
  if (!directSocket || directSocket.readyState !== WebSocket.OPEN) {
    if (import.meta.env.DEV) {
      console.warn('Direct WebSocket not connected. Message not sent:', data);
    }
    return;
  }

  // console.log('Direct WS ->', data);
  if (useEncryption && isEncryptionAvailable()) {
    const encrypted = await encryptString(data);
    directSocket.send(encrypted);
  } else {
    directSocket.send(data);
  }
};

/**
 * Check if direct WebSocket is connected.
 */
export const isDirectConnected = (): boolean => {
  return directSocket !== null && directSocket.readyState === WebSocket.OPEN;
};

/**
 * Check if direct WebSocket is connecting.
 */
export const isDirectConnecting = (): boolean => {
  return isDirectConnectingFlag || (directSocket !== null && directSocket.readyState === WebSocket.CONNECTING);
};

/**
 * Disconnect the direct WebSocket connection.
 * Just closes the WebSocket - the server/backend handles QUIT.
 */
export const disconnectDirect = (): void => {
  if (directSocket) {
    directSocket.close();
    directSocket = null;
  }
  isDirectConnectingFlag = false;
  hasReceivedWelcome = false;
  useEncryption = false;
  messageQueue = [];
  isProcessingQueue = false;
};
