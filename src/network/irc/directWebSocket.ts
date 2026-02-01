import { type Server } from './servers';
import { parseServer } from './helpers';

// Direct WebSocket connection to IRC server (bypassing backend)
let directSocket: WebSocket | null = null;
let isDirectConnectingFlag = false;

// Event callback for IRC events (set by network.ts)
let eventCallback: ((eventName: string, data: unknown) => void) | null = null;

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

  console.log('Direct WebSocket: connecting to', wsUrl);
  directSocket = new WebSocket(wsUrl);

  directSocket.onopen = () => {
    isDirectConnectingFlag = false;
    console.log('Direct WebSocket connected');

    // Send CAP LS to start capability negotiation
    sendDirectRaw('CAP LS 302');

    // Send NICK and USER
    sendDirectRaw(`NICK ${nick}`);
    sendDirectRaw(`USER ${nick} 0 * :${nick}`);

    triggerDirectEvent('connect', {});
  };

  directSocket.onmessage = (event) => {
    const data = event.data as string;
    // IRC messages are separated by \r\n, but WebSocket messages come one at a time
    // However, some servers might batch messages, so split just in case
    const lines = data.split(/\r?\n/).filter((line) => line.length > 0);

    for (const line of lines) {
      // console.log('Direct WS <-', line);
      handleIrcMessage(line);
    }
  };

  directSocket.onerror = (error) => {
    isDirectConnectingFlag = false;
    console.error('Direct WebSocket error:', error);
    triggerDirectEvent('error', error);
  };

  directSocket.onclose = () => {
    isDirectConnectingFlag = false;
    console.log('Direct WebSocket disconnected');
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
 */
export const sendDirectRaw = (data: string): void => {
  if (!directSocket || directSocket.readyState !== WebSocket.OPEN) {
    console.warn('Direct WebSocket not connected. Message not sent:', data);
    return;
  }

  // console.log('Direct WS ->', data);
  directSocket.send(data);
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
 * Sends QUIT command before closing.
 */
export const disconnectDirect = (reason?: string): void => {
  if (directSocket) {
    if (directSocket.readyState === WebSocket.OPEN) {
      // Send QUIT command
      const quitMsg = reason ? `QUIT :${reason}` : 'QUIT';
      sendDirectRaw(quitMsg);
    }
    directSocket.close();
    directSocket = null;
  }
  isDirectConnectingFlag = false;
  hasReceivedWelcome = false;
};
