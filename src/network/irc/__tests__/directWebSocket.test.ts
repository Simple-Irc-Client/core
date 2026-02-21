/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Server } from '../servers';

// Mock encryption module
const mockDecryptString = vi.fn<(str: string) => Promise<string>>();
const mockIsEncryptionAvailable = vi.fn<() => boolean>();

vi.mock('@/network/encryption', () => ({
  encryptString: vi.fn().mockImplementation((str: string) => Promise.resolve(`encrypted:${str}`)),
  decryptString: (...args: unknown[]) => mockDecryptString(...(args as [string])),
  isEncryptionAvailable: () => mockIsEncryptionAvailable(),
}));

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

    it('should remove event handlers from old socket when creating new one', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      directWebSocket.initDirectWebSocket(server, 'TestNick');
      const firstSocket = lastCreatedSocket as MockWebSocket;

      // Simulate connection established to clear isDirectConnectingFlag
      await firstSocket.onopen?.();

      // The first socket should have handlers
      expect(firstSocket.onclose).not.toBeNull();
      expect(firstSocket.onmessage).not.toBeNull();

      // Create a second connection (replacing the first)
      directWebSocket.initDirectWebSocket(server, 'TestNick2');

      // Handlers on the old socket should have been removed to prevent
      // stale onclose from nulling out the new socket reference
      expect(firstSocket.onclose).toBeNull();
      expect(firstSocket.onerror).toBeNull();
      expect(firstSocket.onmessage).toBeNull();
      expect(firstSocket.onopen).toBeNull();
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
        'Direct WebSocket not connected. Message not sent.'
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

  describe('message queue - sequential processing', () => {
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

    it('should process messages in order without encryption', async () => {
      mockIsEncryptionAvailable.mockReturnValue(false);
      const socket = await connectAndGetSocket();

      // Dispatch multiple messages rapidly
      socket.onmessage?.({ data: ':server 322 nick #channel1 10 :Topic 1' });
      socket.onmessage?.({ data: ':server 322 nick #channel2 20 :Topic 2' });
      socket.onmessage?.({ data: ':server 322 nick #channel3 30 :Topic 3' });
      socket.onmessage?.({ data: ':server 323 nick :End of /LIST' });

      // Allow microtask queue to flush
      await new Promise((r) => setTimeout(r, 0));

      const rawLines = eventCallback.mock.calls
        .filter((call) => call[0] === 'sic-irc-event' && call[1]?.type === 'raw')
        .map((call) => call[1].line as string);
      expect(rawLines).toHaveLength(4);
      expect(rawLines).toEqual([
        expect.stringContaining('#channel1'),
        expect.stringContaining('#channel2'),
        expect.stringContaining('#channel3'),
        expect.stringContaining('323'),
      ]);
    });

    it('should process encrypted messages sequentially in arrival order', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);

      // Simulate async decryption with varying delays
      const decryptionOrder: string[] = [];
      mockDecryptString.mockImplementation(async (data: string) => {
        // Simulate variable decryption time - later messages resolve faster
        const delay = data.includes('msg1') ? 30 : data.includes('msg2') ? 20 : 10;
        await new Promise((r) => setTimeout(r, delay));
        decryptionOrder.push(data);
        return data.replace('enc:', '');
      });

      const socket = await connectAndGetSocket();
      directWebSocket.setDirectEncryption(true);

      socket.onmessage?.({ data: 'enc::server 322 nick #channel1 10 :msg1' });
      socket.onmessage?.({ data: 'enc::server 322 nick #channel2 20 :msg2' });
      socket.onmessage?.({ data: 'enc::server 323 nick :msg3' });

      // Wait for all decryptions to complete
      await new Promise((r) => setTimeout(r, 150));

      // Messages should be decrypted sequentially (in arrival order)
      expect(decryptionOrder[0]).toContain('msg1');
      expect(decryptionOrder[1]).toContain('msg2');
      expect(decryptionOrder[2]).toContain('msg3');

      // Events should arrive in order
      const rawLines = eventCallback.mock.calls
        .filter((call) => call[0] === 'sic-irc-event' && call[1]?.type === 'raw')
        .map((call) => call[1].line as string);
      expect(rawLines).toHaveLength(3);
      expect(rawLines).toEqual([
        expect.stringContaining('#channel1'),
        expect.stringContaining('#channel2'),
        expect.stringContaining('323'),
      ]);
    });

    it('should skip messages that fail decryption and continue processing', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      mockDecryptString.mockImplementation(async (data: string) => {
        if (data === 'bad-data') {
          throw new Error('Decryption failed');
        }
        return data.replace('enc:', '');
      });

      const socket = await connectAndGetSocket();
      directWebSocket.setDirectEncryption(true);

      socket.onmessage?.({ data: 'enc::server NOTICE * :First' });
      socket.onmessage?.({ data: 'bad-data' });
      socket.onmessage?.({ data: 'enc::server NOTICE * :Third' });

      await new Promise((r) => setTimeout(r, 50));

      const rawLines = eventCallback.mock.calls
        .filter((call) => call[0] === 'sic-irc-event' && call[1]?.type === 'raw')
        .map((call) => call[1].line as string);
      expect(rawLines).toHaveLength(2);
      expect(rawLines).toEqual([
        expect.stringContaining('First'),
        expect.stringContaining('Third'),
      ]);
    });

    it('should clear the message queue on disconnect', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);

      // Make decryption slow so messages stay in queue
      mockDecryptString.mockImplementation(async (data: string) => {
        await new Promise((r) => setTimeout(r, 100));
        return data.replace('enc:', '');
      });

      const socket = await connectAndGetSocket();
      directWebSocket.setDirectEncryption(true);

      socket.onmessage?.({ data: 'enc::server 322 nick #channel1 10 :Topic' });
      socket.onmessage?.({ data: 'enc::server 322 nick #channel2 20 :Topic' });
      socket.onmessage?.({ data: 'enc::server 322 nick #channel3 30 :Topic' });

      // Disconnect before processing completes
      directWebSocket.disconnectDirect();

      await new Promise((r) => setTimeout(r, 200));

      // At most the first message might have been processed (it was already decrypting)
      const rawCalls = eventCallback.mock.calls.filter(
        (call) => call[0] === 'sic-irc-event' && call[1]?.type === 'raw'
      );
      expect(rawCalls.length).toBeLessThanOrEqual(1);
    });

    it('should not use decryption when encryption is disabled', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      mockDecryptString.mockClear();

      const socket = await connectAndGetSocket();
      // Encryption off by default (setDirectEncryption not called)

      socket.onmessage?.({ data: ':server NOTICE * :Hello' });

      await new Promise((r) => setTimeout(r, 0));

      expect(mockDecryptString).not.toHaveBeenCalled();
      expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
        type: 'raw',
        line: ':server NOTICE * :Hello',
      });
    });

    it('should encrypt outgoing messages when encryption is enabled', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);

      const socket = await connectAndGetSocket();
      directWebSocket.setDirectEncryption(true);

      await directWebSocket.sendDirectRaw('PRIVMSG #test :Hello');

      expect(socket.send).toHaveBeenCalledWith('encrypted:PRIVMSG #test :Hello');
    });
  });
});
