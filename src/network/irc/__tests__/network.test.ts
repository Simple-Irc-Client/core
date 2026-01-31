import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Server } from '../servers';

// Mock config before importing network module
vi.mock('@/config/config', () => ({
  websocketHost: 'localhost',
  websocketPort: 8080,
  defaultIRCPort: 6667,
  encryptionKey: 'test-key',
  gatewayHost: '',
  gatewayPort: 8667,
  gatewayPath: '/irc',
  isGatewayMode: () => false,
}));

// Mock encryption module to pass through unencrypted for testing
vi.mock('@/network/encryption', () => ({
  initEncryption: vi.fn().mockResolvedValue(undefined),
  encryptMessage: vi.fn().mockImplementation((data) => Promise.resolve(JSON.stringify(data))),
  decryptMessage: vi.fn().mockImplementation((data) => Promise.resolve(JSON.parse(data))),
  isEncryptionAvailable: vi.fn().mockReturnValue(false),
}));

// Mock channels store
const mockSetAddMessageToAllChannels = vi.fn();
vi.mock('@features/channels/store/channels', () => ({
  setAddMessageToAllChannels: (msg: unknown) => mockSetAddMessageToAllChannels(msg),
}));

// Mock i18next
vi.mock('@/app/i18n', () => ({
  default: {
    t: (key: string) => key,
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
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

// Helper to flush pending promises (works with fake timers)
const flushPromises = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

describe('network', () => {
  let network: typeof import('../network');

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    lastCreatedSocket = null;
    mockSetAddMessageToAllChannels.mockClear();
    network = await import('../network');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const getSocket = (): MockWebSocket => {
    network.initWebSocket();
    if (!lastCreatedSocket) {
      throw new Error('Socket was not created');
    }
    return lastCreatedSocket;
  };

  describe('initWebSocket', () => {
    it('should create a new WebSocket connection', () => {
      const socket = getSocket();
      expect(socket).toBeDefined();
      expect(socket.url).toBe('ws://localhost:8080/SimpleIrcClient');
    });

    it('should return existing socket if already open', () => {
      const socket1 = getSocket();
      socket1.readyState = 1; // OPEN

      network.initWebSocket();
      // Should not create a new socket
      expect(lastCreatedSocket).toBe(socket1);
    });

    it('should return existing socket if connecting', () => {
      const socket1 = getSocket();
      socket1.readyState = 0; // CONNECTING

      network.initWebSocket();
      // Should not create a new socket
      expect(lastCreatedSocket).toBe(socket1);
    });
  });

  describe('on/off event handlers', () => {
    it('should register and call event handlers', async () => {
      const handler = vi.fn();
      network.on('custom-event', handler);

      // Manually trigger onmessage to fire custom event
      const socket = getSocket();
      socket.onmessage?.({
        data: JSON.stringify({ event: 'custom-event', data: { foo: 'bar' } }),
      });

      await flushPromises();
      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should remove event handlers with off', async () => {
      const handler = vi.fn();
      network.on('custom-event', handler);
      network.off('custom-event', handler);

      const socket = getSocket();
      socket.onmessage?.({
        data: JSON.stringify({ event: 'custom-event', data: {} }),
      });

      await flushPromises();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent handler gracefully', () => {
      const handler = vi.fn();
      expect(() => network.off('non-existent', handler)).not.toThrow();
    });
  });

  describe('getSocket', () => {
    it('should return existing socket or create new one', () => {
      const socket = network.getSocket();
      expect(socket).toBeDefined();
    });
  });

  describe('isConnected', () => {
    it('should return false when socket is not open', async () => {
      // Need fresh module without socket initialized
      vi.resetModules();
      const freshNetwork = await import('../network');
      // Don't init socket, check isConnected
      expect(freshNetwork.isConnected()).toBe(false);
    });

    it('should return true when socket is open', () => {
      const socket = getSocket();
      socket.readyState = 1; // OPEN
      expect(network.isConnected()).toBe(true);
    });
  });

  describe('ircConnect', () => {
    it('should send connect command with server details', async () => {
      const socket = getSocket();

      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      };

      network.ircConnect(server, 'testNick');
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'connect',
            event: {
              nick: 'testNick',
              server: {
                host: 'irc.test.net',
                port: 6667,
                encoding: 'utf8',
                tls: false,
              },
            },
          },
        })
      );
    });

    it('should use default port when not specified', async () => {
      const socket = getSocket();

      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net'],
      };

      network.ircConnect(server, 'testNick');
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'connect',
            event: {
              nick: 'testNick',
              server: {
                host: 'irc.test.net',
                port: 6667,
                encoding: 'utf8',
                tls: false,
              },
            },
          },
        })
      );
    });

    it('should throw error when server host is empty', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: [],
      };

      expect(() => network.ircConnect(server, 'testNick')).toThrow(
        'Unable to connect to IRC network - server host is empty'
      );
    });

    it('should throw error when server is undefined', () => {
      expect(() => network.ircConnect(undefined as unknown as Server, 'testNick')).toThrow(
        'Unable to connect to IRC network - server host is empty'
      );
    });
  });

  describe('ircSendPassword', () => {
    it('should send IDENTIFY command to NickServ', async () => {
      const socket = getSocket();

      network.ircSendPassword('myPassword');
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'PRIVMSG NickServ :IDENTIFY myPassword\n',
            },
          },
        })
      );
    });
  });

  describe('ircSendList', () => {
    it('should send LIST command', async () => {
      const socket = getSocket();

      network.ircSendList();
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'LIST\n',
            },
          },
        })
      );
    });
  });

  describe('ircSendNamesXProto', () => {
    it('should send PROTOCTL NAMESX command', async () => {
      const socket = getSocket();

      network.ircSendNamesXProto();
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'PROTOCTL NAMESX\n',
            },
          },
        })
      );
    });
  });

  describe('ircJoinChannels', () => {
    it('should send JOIN command for single channel', async () => {
      const socket = getSocket();

      network.ircJoinChannels(['#test']);
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'JOIN #test\n',
            },
          },
        })
      );
    });

    it('should send JOIN command for multiple channels', async () => {
      const socket = getSocket();

      network.ircJoinChannels(['#test', '#foo', '#bar']);
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'JOIN #test,#foo,#bar\n',
            },
          },
        })
      );
    });
  });

  describe('ircPartChannel', () => {
    it('should send PART command', async () => {
      const socket = getSocket();

      network.ircPartChannel('#test');
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'PART #test\n',
            },
          },
        })
      );
    });
  });

  describe('ircRequestMetadataItem', () => {
    it('should send METADATA GET command to queue', async () => {
      const socket = getSocket();

      network.ircRequestMetadataItem('someUser', 'avatar');

      // Queued messages are sent via interval, not immediately
      expect(socket.send).not.toHaveBeenCalled();

      // Advance timer to trigger queue processing
      vi.advanceTimersByTime(300);
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'METADATA someUser GET avatar\n',
            },
          },
        })
      );
    });
  });

  describe('ircRequestMetadata', () => {
    it('should send METADATA SUB command', async () => {
      const socket = getSocket();

      network.ircRequestMetadata();
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'METADATA * SUB avatar status bot homepage display-name bot-url color\n',
            },
          },
        })
      );
    });
  });

  describe('ircRequestMetadataList', () => {
    it('should send METADATA LIST command to queue', async () => {
      const socket = getSocket();

      network.ircRequestMetadataList('someUser');

      // Queued messages are sent via interval
      vi.advanceTimersByTime(300);
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'METADATA someUser LIST\n',
            },
          },
        })
      );
    });
  });

  describe('ircSendRawMessage', () => {
    it('should send raw message', async () => {
      const socket = getSocket();

      network.ircSendRawMessage('PRIVMSG #test :Hello world');
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'PRIVMSG #test :Hello world\n',
            },
          },
        })
      );
    });

    it('should not send empty messages', async () => {
      const socket = getSocket();

      network.ircSendRawMessage('');
      await flushPromises();

      expect(socket.send).not.toHaveBeenCalled();
    });

    it('should queue message when queue flag is true', async () => {
      const socket = getSocket();

      network.ircSendRawMessage('TEST MESSAGE', true);

      // Should not be sent immediately
      expect(socket.send).not.toHaveBeenCalled();

      // Advance timer to trigger queue processing
      vi.advanceTimersByTime(300);
      await flushPromises();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'sic-client-event',
          data: {
            type: 'raw',
            event: {
              rawData: 'TEST MESSAGE\n',
            },
          },
        })
      );
    });

    it('should not send when socket is not open', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const socket = getSocket();
      socket.readyState = 0; // CONNECTING

      network.ircSendRawMessage('TEST');
      await flushPromises();

      expect(socket.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket is not connected. Message not sent:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('WebSocket events', () => {
    it('should trigger connect event on socket open', async () => {
      const connectHandler = vi.fn();
      network.on('connect', connectHandler);

      const socket = getSocket();
      socket.onopen?.();
      await flushPromises();

      expect(connectHandler).toHaveBeenCalledWith({});
    });

    it('should trigger sic-irc-event with close type on socket close', () => {
      const ircEventHandler = vi.fn();
      network.on('sic-irc-event', ircEventHandler);

      const socket = getSocket();
      socket.onclose?.();

      expect(ircEventHandler).toHaveBeenCalledWith({ type: 'close' });
    });

    it('should trigger error event on socket error', () => {
      const errorHandler = vi.fn();
      network.on('error', errorHandler);

      const socket = getSocket();
      const mockError = new Event('error');
      socket.onerror?.(mockError);

      expect(errorHandler).toHaveBeenCalledWith(mockError);
    });

    it('should parse and trigger events from incoming messages', async () => {
      const messageHandler = vi.fn();
      network.on('irc-message', messageHandler);

      const socket = getSocket();

      socket.onmessage?.({
        data: JSON.stringify({ event: 'irc-message', data: { text: 'hello' } }),
      });
      await flushPromises();

      expect(messageHandler).toHaveBeenCalledWith({ text: 'hello' });
    });

    it('should handle invalid JSON in messages gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const socket = getSocket();

      socket.onmessage?.({ data: 'invalid json' });
      await flushPromises();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should ignore messages without event field', async () => {
      const messageHandler = vi.fn();
      network.on('some-event', messageHandler);

      const socket = getSocket();

      socket.onmessage?.({
        data: JSON.stringify({ data: { text: 'hello' } }),
      });
      await flushPromises();

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('inactivity timeout', () => {
    const INACTIVITY_TIMEOUT_MS = 120 * 1000; // 120 seconds

    it('should show disconnection message after 120 seconds of inactivity', async () => {
      const socket = getSocket();
      socket.onopen?.();
      await flushPromises();

      // Advance time to just before timeout
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1);
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        message: 'kernel.inactivityTimeout',
        time: expect.any(String),
        category: 'error',
      });
    });

    it('should reset timeout when message is received', async () => {
      const socket = getSocket();
      socket.onopen?.();
      await flushPromises();

      // Advance time to 60 seconds
      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      // Receive a message - this should reset the timeout
      socket.onmessage?.({
        data: JSON.stringify({ event: 'test', data: {} }),
      });
      await flushPromises();

      // Advance time to 60 seconds again (120 seconds total from start)
      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      // Advance to trigger timeout (120 seconds from last message)
      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
    });

    it('should clear timeout when socket closes', async () => {
      const socket = getSocket();
      socket.onopen?.();
      await flushPromises();

      // Advance time to 60 seconds
      vi.advanceTimersByTime(60 * 1000);

      // Close socket - should clear timeout
      socket.onclose?.();

      // Advance past original timeout
      vi.advanceTimersByTime(120 * 1000);

      // Should not have triggered because socket was closed
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
    });

    it('should clear timeout when ircDisconnect is called', async () => {
      const socket = getSocket();
      socket.onopen?.();
      await flushPromises();

      // Advance time to 60 seconds
      vi.advanceTimersByTime(60 * 1000);

      // Disconnect - should clear timeout
      network.ircDisconnect();

      // Advance past original timeout
      vi.advanceTimersByTime(120 * 1000);

      // Should not have triggered because we disconnected
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
    });

    it('should not show message if no socket was opened', () => {
      // Don't call onopen, just advance time
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS + 1000);

      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
    });
  });
});
