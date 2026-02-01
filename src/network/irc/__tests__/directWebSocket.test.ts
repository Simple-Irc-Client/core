/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Server } from '../servers';

// Mock helpers module
vi.mock('../helpers', () => ({
  parseServer: vi.fn((server: Server) => {
    if (!server || !server.servers || server.servers.length === 0) {
      return undefined;
    }
    const serverStr = server.servers[0];
    if (!serverStr) return undefined;
    const [hostPart, portPart] = serverStr.split(':');
    return {
      host: hostPart,
      port: portPart ? parseInt(portPart, 10) : 6667,
      tls: server.tls ?? false,
    };
  }),
}));

// Mock WebSocket interface
interface MockWebSocket {
  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((error: Event) => void) | null;
  onclose: (() => void) | null;
  send: Mock;
  close: Mock;
}

// Store for created mock sockets
let lastCreatedSocket: MockWebSocket | null = null;

const setLastCreatedSocket = (socket: MockWebSocket) => {
  lastCreatedSocket = socket;
};

// Mock WebSocket class
class MockWebSocketClass implements MockWebSocket {
  url: string;
  readyState = 1; // OPEN
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  send: Mock = vi.fn();
  close: Mock = vi.fn();

  constructor(url: string) {
    this.url = url;
    setLastCreatedSocket(this);
  }
}

// Add static properties
Object.assign(MockWebSocketClass, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

// Assign mock to global
vi.stubGlobal('WebSocket', MockWebSocketClass);

describe('directWebSocket', () => {
  let directWebSocket: typeof import('../directWebSocket');
  let eventCallback: Mock;

  beforeEach(async () => {
    vi.resetModules();
    lastCreatedSocket = null;
    eventCallback = vi.fn();
    directWebSocket = await import('../directWebSocket');
    directWebSocket.setDirectEventCallback(eventCallback);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initDirectWebSocket', () => {
    it('should create a WebSocket connection with explicit websocketUrl', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');

      expect(lastCreatedSocket).toBeDefined();
      expect(lastCreatedSocket?.url).toBe('wss://testnet.example.com/');
    });

    it('should construct WebSocket URL from server info when websocketUrl is not provided', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com:8080'],
        connectionType: 'websocket',
        tls: true,
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');

      expect(lastCreatedSocket).toBeDefined();
      expect(lastCreatedSocket?.url).toBe('wss://testnet.example.com:8080');
    });

    it('should use ws:// protocol when tls is false', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com:8080'],
        connectionType: 'websocket',
        tls: false,
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');

      expect(lastCreatedSocket?.url).toBe('ws://testnet.example.com:8080');
    });

    it('should throw error when server host is empty', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: [],
        connectionType: 'websocket',
      };

      expect(() => directWebSocket.initDirectWebSocket(server, 'TestNick')).toThrow(
        'Unable to connect - server host is empty'
      );
    });

    it('should send CAP LS, NICK, and USER on connection open', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      await lastCreatedSocket?.onopen?.();

      expect(lastCreatedSocket?.send).toHaveBeenCalledWith('CAP LS 302');
      expect(lastCreatedSocket?.send).toHaveBeenCalledWith('NICK TestNick');
      expect(lastCreatedSocket?.send).toHaveBeenCalledWith('USER TestNick 0 * :TestNick');
    });

    it('should trigger connect event on socket open', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      await lastCreatedSocket?.onopen?.();

      expect(eventCallback).toHaveBeenCalledWith('connect', {});
    });

    it('should close existing connection before creating new one', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      const firstSocket = lastCreatedSocket;

      // Simulate connection established to clear isDirectConnectingFlag
      await firstSocket?.onopen?.();

      directWebSocket.initDirectWebSocket(server, 'TestNick2');

      expect(firstSocket?.close).toHaveBeenCalled();
    });
  });

  describe('sendDirectRaw', () => {
    it('should send raw IRC command without newline', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      await lastCreatedSocket?.onopen?.();
      lastCreatedSocket?.send.mockClear();

      await directWebSocket.sendDirectRaw('PRIVMSG #test :Hello');

      expect(lastCreatedSocket?.send).toHaveBeenCalledWith('PRIVMSG #test :Hello');
    });

    it('should not send when socket is not connected', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      directWebSocket.sendDirectRaw('TEST');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Direct WebSocket not connected. Message not sent:',
        'TEST'
      );
      consoleSpy.mockRestore();
    });

    it('should not send when socket is not open', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      if (lastCreatedSocket) {
        lastCreatedSocket.readyState = 0; // CONNECTING
      }

      directWebSocket.sendDirectRaw('TEST');

      expect(lastCreatedSocket?.send).not.toHaveBeenCalledWith('TEST');
      consoleSpy.mockRestore();
    });
  });

  describe('isDirectConnected', () => {
    it('should return false when no socket exists', () => {
      expect(directWebSocket.isDirectConnected()).toBe(false);
    });

    it('should return true when socket is open', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      if (lastCreatedSocket) {
        lastCreatedSocket.readyState = 1; // OPEN
      }

      expect(directWebSocket.isDirectConnected()).toBe(true);
    });

    it('should return false when socket is not open', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      if (lastCreatedSocket) {
        lastCreatedSocket.readyState = 0; // CONNECTING
      }

      expect(directWebSocket.isDirectConnected()).toBe(false);
    });
  });

  describe('isDirectConnecting', () => {
    it('should return false when no socket exists', () => {
      expect(directWebSocket.isDirectConnecting()).toBe(false);
    });

    it('should return true when socket is connecting', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      if (lastCreatedSocket) {
        lastCreatedSocket.readyState = 0; // CONNECTING
      }

      expect(directWebSocket.isDirectConnecting()).toBe(true);
    });
  });

  describe('disconnectDirect', () => {
    it('should close socket without sending QUIT', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      await lastCreatedSocket?.onopen?.();
      lastCreatedSocket?.send.mockClear();

      directWebSocket.disconnectDirect();

      // Should not send QUIT - server/backend handles it
      expect(lastCreatedSocket?.send).not.toHaveBeenCalled();
      expect(lastCreatedSocket?.close).toHaveBeenCalled();
    });

    it('should handle disconnect when no socket exists', () => {
      expect(() => directWebSocket.disconnectDirect()).not.toThrow();
    });
  });

  describe('IRC message handling', () => {
    const connectAndGetSocket = async (): Promise<MockWebSocket> => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      await lastCreatedSocket?.onopen?.();
      eventCallback.mockClear();

      if (!lastCreatedSocket) {
        throw new Error('Socket not created');
      }
      return lastCreatedSocket;
    };

    it('should pass PING through to kernel (kernel handles PONG response)', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({ data: 'PING :server123' });

      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
        type: 'raw',
        line: 'PING :server123',
      });
    });

    it('should send raw IRC messages to kernel as raw events', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({ data: ':nick!user@host PRIVMSG #channel :Hello world' });

      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
        type: 'raw',
        line: ':nick!user@host PRIVMSG #channel :Hello world',
      });
    });

    it('should send numeric replies to kernel as raw events', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({ data: ':server 001 TestNick :Welcome to the network' });

      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
        type: 'raw',
        line: ':server 001 TestNick :Welcome to the network',
      });
    });

    it('should handle batched messages separated by newlines', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({
        data: ':nick1!user@host PRIVMSG #channel :Message 1\r\n:nick2!user@host PRIVMSG #channel :Message 2',
      });

      expect(eventCallback).toHaveBeenCalledTimes(2);
      expect(eventCallback).toHaveBeenNthCalledWith(1, 'sic-irc-event', {
        type: 'raw',
        line: ':nick1!user@host PRIVMSG #channel :Message 1',
      });
      expect(eventCallback).toHaveBeenNthCalledWith(2, 'sic-irc-event', {
        type: 'raw',
        line: ':nick2!user@host PRIVMSG #channel :Message 2',
      });
    });

    it('should handle messages with IRCv3 tags', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({
        data: '@time=2023-01-01T12:00:00.000Z;msgid=abc123 :nick!user@host PRIVMSG #channel :Hello',
      });

      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
        type: 'raw',
        line: '@time=2023-01-01T12:00:00.000Z;msgid=abc123 :nick!user@host PRIVMSG #channel :Hello',
      });
    });

    it('should trigger connected event when RPL_WELCOME (001) is received', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({ data: ':server 001 TestNick :Welcome to the network' });

      // Should trigger 'connected' before the 'raw' event
      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'connected' });
      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
        type: 'raw',
        line: ':server 001 TestNick :Welcome to the network',
      });
    });

    it('should trigger connected event for 001 with IRCv3 tags', async () => {
      const socket = await connectAndGetSocket();

      socket.onmessage?.({
        data: '@time=2023-01-01T12:00:00.000Z :server 001 TestNick :Welcome',
      });

      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'connected' });
    });

    it('should only trigger connected event once', async () => {
      const socket = await connectAndGetSocket();

      // First 001 message
      socket.onmessage?.({ data: ':server 001 TestNick :Welcome' });
      // Second 001 message (shouldn't happen in practice, but test the guard)
      socket.onmessage?.({ data: ':server 001 TestNick :Another welcome' });

      // 'connected' should only be called once
      const connectedCalls = eventCallback.mock.calls.filter(
        (call) => call[0] === 'sic-irc-event' && call[1]?.type === 'connected'
      );
      expect(connectedCalls).toHaveLength(1);
    });
  });

  describe('WebSocket events', () => {
    it('should trigger sic-irc-event with close type on socket close', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      lastCreatedSocket?.onclose?.();

      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'close' });
    });

    it('should trigger error event on socket error', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      const mockError = new Event('error');
      lastCreatedSocket?.onerror?.(mockError);

      expect(eventCallback).toHaveBeenCalledWith('error', mockError);
    });
  });
});
