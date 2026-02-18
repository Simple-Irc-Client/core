import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from '../servers';

// Mock config before importing network module
vi.mock('@/config/config', () => ({
  localBackendHost: 'localhost',
  localBackendPort: 8080,
  localBackendPath: 'webirc',
  defaultIRCPort: 6667,
  encryptionKey: 'test-key',
  gatewayHost: '',
  gatewayPort: 8667,
  gatewayPath: '/webirc',
  isGatewayMode: () => false,
}));

// Mock sasl module - track credentials
const mockSetSaslCredentials = vi.fn();
const mockGetSaslAccount = vi.fn();
const mockGetSaslPassword = vi.fn();
const mockResetSaslState = vi.fn();
const mockClearSaslCredentials = vi.fn();
const mockSaveSaslCredentialsForReconnect = vi.fn().mockResolvedValue(undefined);
const mockRestoreSaslCredentials = vi.fn().mockResolvedValue(true);
const mockClearSavedCredentials = vi.fn();

vi.mock('../sasl', () => ({
  setSaslCredentials: (...args: unknown[]) => mockSetSaslCredentials(...args),
  getSaslAccount: () => mockGetSaslAccount(),
  getSaslPassword: () => mockGetSaslPassword(),
  resetSaslState: () => mockResetSaslState(),
  clearSaslCredentials: () => mockClearSaslCredentials(),
  saveSaslCredentialsForReconnect: () => mockSaveSaslCredentialsForReconnect(),
  restoreSaslCredentials: () => mockRestoreSaslCredentials(),
  clearSavedCredentials: () => mockClearSavedCredentials(),
}));

// Mock capabilities module
vi.mock('../capabilities', () => ({
  resetCapabilityState: vi.fn(),
  isCapabilityEnabled: vi.fn().mockReturnValue(false),
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
  isEncryptionAvailable: vi.fn().mockReturnValue(true),
  initSessionEncryption: vi.fn().mockResolvedValue(undefined),
  encryptString: vi.fn().mockImplementation((str: string) => Promise.resolve(`encrypted:${str}`)),
  decryptString: vi.fn().mockImplementation((str: string) => Promise.resolve(str.replace('encrypted:', ''))),
}));

// Mock settings store
const mockGetServer = vi.fn();
const mockGetCurrentNick = vi.fn();
const mockSetIsConnected = vi.fn();
const mockSetIsConnecting = vi.fn();
vi.mock('@features/settings/store/settings', () => ({
  getServer: () => mockGetServer(),
  getCurrentNick: () => mockGetCurrentNick(),
  setIsConnected: (val: boolean) => mockSetIsConnecting(val),
  setIsConnecting: (val: boolean) => mockSetIsConnecting(val),
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
    mockGetServer.mockClear();
    mockGetCurrentNick.mockClear();
    mockSetIsConnected.mockClear();
    mockSetIsConnecting.mockClear();
    // SASL mocks
    mockSetSaslCredentials.mockClear();
    mockGetSaslAccount.mockClear();
    mockGetSaslPassword.mockClear();
    mockResetSaslState.mockClear();
    mockClearSaslCredentials.mockClear();
    mockSaveSaslCredentialsForReconnect.mockClear();
    mockRestoreSaslCredentials.mockClear();
    mockClearSavedCredentials.mockClear();
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

    it('should store credentials for reconnect using current nick', () => {
      mockGetCurrentNick.mockReturnValue('myNick');

      network.ircSendPassword('myPassword');

      expect(mockSetSaslCredentials).toHaveBeenCalledWith('myNick', 'myPassword');
    });

    it('should not store credentials if nick is empty', () => {
      mockGetCurrentNick.mockReturnValue('');

      network.ircSendPassword('myPassword');

      expect(mockSetSaslCredentials).not.toHaveBeenCalled();
    });
  });

  describe('ircAuthenticate', () => {
    it('should send IDENTIFY command to NickServ with account and password', () => {
      network.ircAuthenticate('myAccount', 'myPassword');

      expect(mockSendDirectRaw).toHaveBeenCalledWith('PRIVMSG NickServ :IDENTIFY myAccount myPassword');
    });

    it('should store credentials for reconnect', () => {
      network.ircAuthenticate('myAccount', 'myPassword');

      expect(mockSetSaslCredentials).toHaveBeenCalledWith('myAccount', 'myPassword');
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

    it('should truncate messages exceeding 510 bytes', () => {
      const longMessage = 'PRIVMSG #test :' + 'A'.repeat(600);
      network.ircSendRawMessage(longMessage);

      expect(mockSendDirectRaw).toHaveBeenCalledTimes(1);
      const sentMessage = mockSendDirectRaw.mock.calls[0]?.[0] as string;
      expect(sentMessage.length).toBe(510);
      expect(sentMessage).toBe(longMessage.slice(0, 510));
    });

    it('should not truncate messages at exactly 510 bytes', () => {
      const exactMessage = 'A'.repeat(510);
      network.ircSendRawMessage(exactMessage);

      expect(mockSendDirectRaw).toHaveBeenCalledWith(exactMessage);
    });

    it('should not truncate messages under 510 bytes', () => {
      const shortMessage = 'PRIVMSG #test :Hello';
      network.ircSendRawMessage(shortMessage);

      expect(mockSendDirectRaw).toHaveBeenCalledWith(shortMessage);
    });
  });

  describe('inactivity timeout', () => {
    const INACTIVITY_TIMEOUT_MS = 180 * 1000; // 180 seconds

    it('should disconnect and show reconnecting message after timeout', async () => {
      // Setup server and nick for reconnect
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      network.resetInactivityTimeout();

      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(mockDisconnectDirect).toHaveBeenCalled();
      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        message: 'kernel.inactivityTimeoutReconnecting',
        time: expect.any(String),
        category: 'info',
      });
    });

    it('should attempt reconnect after inactivity timeout', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      network.resetInactivityTimeout();

      // Trigger timeout
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);

      // Clear mocks to check reconnect call
      mockInitDirectWebSocket.mockClear();

      // Wait for reconnect delay (2000ms)
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockInitDirectWebSocket).toHaveBeenCalled();
    });

    it('should show max retries message after exhausting reconnect attempts', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      // Exhaust all 3 retries
      for (let i = 0; i < 3; i++) {
        network.resetInactivityTimeout();
        await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);
        await vi.advanceTimersByTimeAsync(2000); // Wait for reconnect attempt
      }

      mockSetAddMessageToAllChannels.mockClear();

      // Fourth timeout should show max retries message
      network.resetInactivityTimeout();
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);

      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        message: 'kernel.inactivityTimeoutMaxRetries',
        time: expect.any(String),
        category: 'error',
      });
    });

    it('should reset retry counter when resetInactivityReconnectRetries is called', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      // Use 2 retries
      for (let i = 0; i < 2; i++) {
        network.resetInactivityTimeout();
        await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);
        await vi.advanceTimersByTimeAsync(2000);
      }

      // Reset retry counter
      network.resetInactivityReconnectRetries();

      // Should be able to retry again
      mockSetAddMessageToAllChannels.mockClear();
      network.resetInactivityTimeout();
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);

      expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        message: 'kernel.inactivityTimeoutReconnecting',
        time: expect.any(String),
        category: 'info',
      });
    });

    it('should reset timeout when resetInactivityTimeout is called', () => {
      network.resetInactivityTimeout();

      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

      network.resetInactivityTimeout();

      vi.advanceTimersByTime(60 * 1000);
      expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
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

    it('should save credentials before disconnect on inactivity timeout', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      network.resetInactivityTimeout();

      // Trigger timeout
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);

      expect(mockSaveSaslCredentialsForReconnect).toHaveBeenCalled();
    });

    it('should restore credentials when reconnecting after timeout', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      network.resetInactivityTimeout();

      // Trigger timeout
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);

      // Wait for reconnect delay
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockRestoreSaslCredentials).toHaveBeenCalled();
    });
  });

  describe('NickServ password preservation on reconnect', () => {
    const INACTIVITY_TIMEOUT_MS = 180 * 1000;

    it('should preserve NickServ password through disconnect/reconnect cycle', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      // Simulate user authenticating with NickServ (not SASL)
      network.ircSendPassword('secretPassword');

      // Verify credentials were stored
      expect(mockSetSaslCredentials).toHaveBeenCalledWith('testNick', 'secretPassword');

      // Start inactivity timeout
      network.resetInactivityTimeout();

      // Trigger timeout - should save credentials
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);
      expect(mockSaveSaslCredentialsForReconnect).toHaveBeenCalled();

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(2000);

      // Credentials should be restored
      expect(mockRestoreSaslCredentials).toHaveBeenCalled();
    });

    it('should preserve ircAuthenticate credentials through disconnect/reconnect cycle', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      // Simulate user authenticating with account and password
      network.ircAuthenticate('myAccount', 'myPassword');

      // Verify credentials were stored
      expect(mockSetSaslCredentials).toHaveBeenCalledWith('myAccount', 'myPassword');

      // Start inactivity timeout
      network.resetInactivityTimeout();

      // Trigger timeout - should save credentials
      await vi.advanceTimersByTimeAsync(INACTIVITY_TIMEOUT_MS);
      expect(mockSaveSaslCredentialsForReconnect).toHaveBeenCalled();

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(2000);

      // Credentials should be restored
      expect(mockRestoreSaslCredentials).toHaveBeenCalled();
    });
  });

  describe('ircReconnect', () => {
    it('should return false when server is undefined', async () => {
      mockGetServer.mockReturnValue(undefined);
      mockGetCurrentNick.mockReturnValue('testNick');

      const result = await network.ircReconnect();

      expect(result).toBe(false);
    });

    it('should return false when nick is empty', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('');

      const result = await network.ircReconnect();

      expect(result).toBe(false);
    });

    it('should reconnect successfully with valid server and nick', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      const result = await network.ircReconnect();

      expect(result).toBe(true);
      expect(mockDisconnectDirect).toHaveBeenCalled();
      await flushPromises();
      expect(mockInitDirectWebSocket).toHaveBeenCalled();
    });

    it('should reset SASL state without clearing credentials', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      await network.ircReconnect();

      expect(mockResetSaslState).toHaveBeenCalled();
      expect(mockClearSaslCredentials).not.toHaveBeenCalled();
    });

    it('should restore SASL credentials before connecting', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      await network.ircReconnect();

      expect(mockRestoreSaslCredentials).toHaveBeenCalled();
    });

    it('should disconnect existing connection before reconnecting', async () => {
      mockGetServer.mockReturnValue({
        default: 0,
        encoding: 'utf8',
        network: 'TestNet',
        servers: ['irc.test.net:6667'],
      });
      mockGetCurrentNick.mockReturnValue('testNick');

      await network.ircReconnect();

      // Disconnect should be called before initDirectWebSocket
      const disconnectOrder = mockDisconnectDirect.mock.invocationCallOrder[0];
      await flushPromises();
      const connectOrder = mockInitDirectWebSocket.mock.invocationCallOrder[0];
      expect(disconnectOrder).toBeLessThan(connectOrder as number);
    });

    it('should not restore credentials or connect when server is missing', async () => {
      mockGetServer.mockReturnValue(undefined);
      mockGetCurrentNick.mockReturnValue('testNick');

      await network.ircReconnect();

      expect(mockRestoreSaslCredentials).not.toHaveBeenCalled();
      expect(mockInitDirectWebSocket).not.toHaveBeenCalled();
    });
  });
});
