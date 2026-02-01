import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from '../servers';

// Mock config before importing network module
vi.mock('@/config/config', () => ({
  websocketHost: 'localhost',
  websocketPort: 8080,
  defaultIRCPort: 6667,
  encryptionKey: 'test-key',
  gatewayHost: '',
  gatewayPort: 8667,
  gatewayPath: '/webirc',
  isGatewayMode: () => false,
}));

// Mock directWebSocket module
const mockInitDirectWebSocket = vi.fn();
const mockSendDirectRaw = vi.fn();
const mockIsDirectConnected = vi.fn().mockReturnValue(false);
const mockIsDirectConnecting = vi.fn().mockReturnValue(false);
const mockDisconnectDirect = vi.fn();
const mockSetDirectEventCallback = vi.fn();
const mockSetDirectEncryption = vi.fn();

vi.mock('../directWebSocket', () => ({
  initDirectWebSocket: (...args: unknown[]) => mockInitDirectWebSocket(...args),
  sendDirectRaw: (...args: unknown[]) => mockSendDirectRaw(...args),
  isDirectConnected: () => mockIsDirectConnected(),
  isDirectConnecting: () => mockIsDirectConnecting(),
  disconnectDirect: (...args: unknown[]) => mockDisconnectDirect(...args),
  setDirectEventCallback: (...args: unknown[]) => mockSetDirectEventCallback(...args),
  setDirectEncryption: (...args: unknown[]) => mockSetDirectEncryption(...args),
}));

// Mock encryption module
vi.mock('@/network/encryption', () => ({
  initEncryption: vi.fn().mockResolvedValue(undefined),
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

// Helper to flush pending promises (works with fake timers)
const flushPromises = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

describe('network', () => {
  let network: typeof import('../network');

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    mockSetAddMessageToAllChannels.mockClear();
    mockInitDirectWebSocket.mockClear();
    mockSendDirectRaw.mockClear();
    mockIsDirectConnected.mockClear().mockReturnValue(false);
    mockIsDirectConnecting.mockClear().mockReturnValue(false);
    mockDisconnectDirect.mockClear();
    mockSetDirectEventCallback.mockClear();
    mockSetDirectEncryption.mockClear();
    network = await import('../network');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('on/off event handlers', () => {
    it('should register and call event handlers', () => {
      const handler = vi.fn();
      network.on('custom-event', handler);

      network.triggerEvent('custom-event', { foo: 'bar' });

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should remove event handlers with off', () => {
      const handler = vi.fn();
      network.on('custom-event', handler);
      network.off('custom-event', handler);

      network.triggerEvent('custom-event', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent handler gracefully', () => {
      const handler = vi.fn();
      expect(() => network.off('non-existent', handler)).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should delegate to isDirectConnected', () => {
      mockIsDirectConnected.mockReturnValue(true);
      expect(network.isConnected()).toBe(true);
      expect(mockIsDirectConnected).toHaveBeenCalled();
    });

    it('should return false when not connected', () => {
      mockIsDirectConnected.mockReturnValue(false);
      expect(network.isConnected()).toBe(false);
    });
  });

  describe('isWebSocketConnecting', () => {
    it('should delegate to isDirectConnecting', () => {
      mockIsDirectConnecting.mockReturnValue(true);
      expect(network.isWebSocketConnecting()).toBe(true);
      expect(mockIsDirectConnecting).toHaveBeenCalled();
    });
  });

  describe('ircDisconnect', () => {
    it('should call disconnectDirect', () => {
      network.ircDisconnect();
      expect(mockDisconnectDirect).toHaveBeenCalled();
    });
  });

  describe('ircConnect', () => {
    it('should use direct WebSocket for local backend mode', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      };

      network.ircConnect(server, 'testNick');
      await flushPromises();

      expect(mockSetDirectEventCallback).toHaveBeenCalledWith(network.triggerEvent);
      expect(mockSetDirectEncryption).toHaveBeenCalledWith(true);
      expect(mockInitDirectWebSocket).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionType: 'websocket',
          websocketUrl: expect.stringContaining('ws://localhost:8080/webirc?'),
        }),
        'testNick'
      );

      // Verify query parameters in WebSocket URL
      const callArgs = mockInitDirectWebSocket.mock.calls[0] as [Server, string];
      const url = new URL(callArgs[0].websocketUrl as string);
      expect(url.searchParams.get('host')).toBe('irc.test.net');
      expect(url.searchParams.get('port')).toBe('6667');
      expect(url.searchParams.get('tls')).toBe('false');
      expect(url.searchParams.get('encoding')).toBe('utf8');
    });

    it('should use default port when not specified', async () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net'],
      };

      network.ircConnect(server, 'testNick');
      await flushPromises();

      expect(mockInitDirectWebSocket).toHaveBeenCalled();

      // Verify default port is used
      const callArgs = mockInitDirectWebSocket.mock.calls[0] as [Server, string];
      const url = new URL(callArgs[0].websocketUrl as string);
      expect(url.searchParams.get('port')).toBe('6667');
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

    it('should route to direct WebSocket when connectionType is websocket', () => {
      const server: Server = {
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['testnet.example.com'],
        connectionType: 'websocket',
        websocketUrl: 'wss://testnet.example.com/',
      };

      network.ircConnect(server, 'testNick');

      expect(mockSetDirectEventCallback).toHaveBeenCalledWith(network.triggerEvent);
      expect(mockSetDirectEncryption).toHaveBeenCalledWith(false);
      expect(mockInitDirectWebSocket).toHaveBeenCalledWith(server, 'testNick');
    });
  });

  describe('ircSendPassword', () => {
    it('should send IDENTIFY command to NickServ', () => {
      network.ircSendPassword('myPassword');

      expect(mockSendDirectRaw).toHaveBeenCalledWith('PRIVMSG NickServ :IDENTIFY myPassword');
    });
  });

  describe('ircSendList', () => {
    it('should send LIST command', () => {
      network.ircSendList();

      expect(mockSendDirectRaw).toHaveBeenCalledWith('LIST');
    });
  });

  describe('ircSendNamesXProto', () => {
    it('should send PROTOCTL NAMESX command', () => {
      network.ircSendNamesXProto();

      expect(mockSendDirectRaw).toHaveBeenCalledWith('PROTOCTL NAMESX');
    });
  });

  describe('ircJoinChannels', () => {
    it('should send JOIN command for single channel', () => {
      network.ircJoinChannels(['#test']);

      expect(mockSendDirectRaw).toHaveBeenCalledWith('JOIN #test');
    });

    it('should send JOIN command for multiple channels', () => {
      network.ircJoinChannels(['#test', '#foo', '#bar']);

      expect(mockSendDirectRaw).toHaveBeenCalledWith('JOIN #test,#foo,#bar');
    });
  });

  describe('ircPartChannel', () => {
    it('should send PART command', () => {
      network.ircPartChannel('#test');

      expect(mockSendDirectRaw).toHaveBeenCalledWith('PART #test');
    });
  });

  describe('ircRequestMetadataItem', () => {
    it('should send METADATA GET command', () => {
      network.ircRequestMetadataItem('someUser', 'avatar');

      expect(mockSendDirectRaw).toHaveBeenCalledWith('METADATA someUser GET avatar');
    });
  });

  describe('ircRequestMetadata', () => {
    it('should send METADATA SUB command', () => {
      network.ircRequestMetadata();

      expect(mockSendDirectRaw).toHaveBeenCalledWith(
        'METADATA * SUB avatar status bot homepage display-name bot-url color'
      );
    });
  });

  describe('ircRequestMetadataList', () => {
    it('should send METADATA LIST command', () => {
      network.ircRequestMetadataList('someUser');

      expect(mockSendDirectRaw).toHaveBeenCalledWith('METADATA someUser LIST');
    });
  });

  describe('ircSendRawMessage', () => {
    it('should send raw message via sendDirectRaw', () => {
      network.ircSendRawMessage('PRIVMSG #test :Hello world');

      expect(mockSendDirectRaw).toHaveBeenCalledWith('PRIVMSG #test :Hello world');
    });

    it('should not send empty messages', () => {
      network.ircSendRawMessage('');

      expect(mockSendDirectRaw).not.toHaveBeenCalled();
    });
  });

  describe('inactivity timeout', () => {
    const INACTIVITY_TIMEOUT_MS = 180 * 1000; // 180 seconds

    it('should show disconnection message after timeout', () => {
      network.resetInactivityTimeout();

      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        message: 'kernel.inactivityTimeout',
        time: expect.any(String),
        category: 'error',
      });
    });

    it('should reset timeout when resetInactivityTimeout is called', () => {
      network.resetInactivityTimeout();

      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      network.resetInactivityTimeout();

      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      vi.advanceTimersByTime(120 * 1000);
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
    });

    it('should clear timeout when clearInactivityTimeout is called', () => {
      network.resetInactivityTimeout();

      vi.advanceTimersByTime(60 * 1000);

      network.clearInactivityTimeout();

      vi.advanceTimersByTime(180 * 1000);

      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
    });

    it('should clear timeout when ircDisconnect is called', () => {
      network.resetInactivityTimeout();

      vi.advanceTimersByTime(60 * 1000);

      network.ircDisconnect();

      vi.advanceTimersByTime(180 * 1000);

      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
    });
  });
});
