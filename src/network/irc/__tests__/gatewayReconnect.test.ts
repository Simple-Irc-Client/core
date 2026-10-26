/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/config', () => ({
  defaultQuitMessage: 'bye',
  defaultIRCPort: 6667,
  localBackendHost: 'localhost',
  localBackendPort: 8080,
  localBackendPath: 'webirc',
  encryptionKey: '',
  gatewayHost: 'gateway.test',
  gatewayPort: 8667,
  gatewayPath: '/webirc',
  isGatewayMode: () => true,
}));

const mockResetCapabilityState = vi.fn();
vi.mock('../capabilities', () => ({
  resetCapabilityState: () => mockResetCapabilityState(),
  isCapabilityEnabled: () => false,
}));

vi.mock('../sasl', () => ({
  setSaslCredentials: vi.fn(),
  resetSaslState: vi.fn(),
  clearSaslCredentials: vi.fn(),
  saveSaslCredentialsForReconnect: vi.fn().mockResolvedValue(undefined),
  restoreSaslCredentials: vi.fn().mockResolvedValue(true),
  clearSavedCredentials: vi.fn(),
}));

const mockInitDirectWebSocket = vi.fn();
const mockSendDirectRaw = vi.fn();
const mockIsDirectConnected = vi.fn();
const mockDisconnectDirect = vi.fn();
vi.mock('../directWebSocket', () => ({
  initDirectWebSocket: (...args: unknown[]) => mockInitDirectWebSocket(...args),
  sendDirectRaw: (...args: unknown[]) => mockSendDirectRaw(...args),
  isDirectConnected: () => mockIsDirectConnected(),
  isDirectConnecting: () => false,
  disconnectDirect: () => mockDisconnectDirect(),
  setDirectEventCallback: vi.fn(),
  setDirectEncryption: vi.fn(),
}));

vi.mock('@/network/encryption', () => ({
  initEncryption: vi.fn().mockResolvedValue(undefined),
  isEncryptionAvailable: () => false,
  decryptPersistent: vi.fn(),
}));

const server = { default: 0, encoding: 'utf8', network: 'TestNet', servers: ['irc.test.net:6697'], tls: true };
const plaintextServer = { default: 0, encoding: 'utf8', network: 'TestNet', servers: ['irc.test.net:6667'], tls: false };
let settingsServer = server;
vi.mock('@features/settings/store/settings', () => ({
  getEncryptedPassword: () => undefined,
  getPasswordNick: () => undefined,
}));

vi.mock('@features/networks/store/networks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/networks/store/networks')>()),
  getServer: () => settingsServer,
  getCurrentNick: () => 'tester',
  setNick: vi.fn(),
  setIsConnected: vi.fn(),
  setIsConnecting: vi.fn(),
  getLineLenLimit: () => 0,
  getCurrentChannelName: () => '#current',
  isSameName: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
}));

vi.mock('@features/channels/store/channels', () => ({
  setAddMessageToAllChannels: vi.fn(),
  clearAllTyping: vi.fn(),
}));

vi.mock('@/app/i18n', () => ({ default: { t: (key: string) => key } }));

describe('network in gateway mode', () => {
  let network: typeof import('../network');
  let gatewaySession: typeof import('../gatewaySession');

  const lastConnectParams = (): URLSearchParams => {
    const { websocketUrl } = mockInitDirectWebSocket.mock.calls.at(-1)?.[0] as { websocketUrl: string };
    return new URL(websocketUrl).searchParams;
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionStorage.clear();
    settingsServer = server;
    mockIsDirectConnected.mockReturnValue(true);
    network = await import('../network');
    gatewaySession = await import('../gatewaySession');
  });

  afterEach(() => {
    network.clearInactivityTimeout();
    vi.useRealTimers();
  });

  it('asks the gateway for a resumable session', () => {
    network.ircConnect(server, 'tester');

    expect(lastConnectParams().get('session')).toBe('true');
    expect(lastConnectParams().has('resume')).toBe(false);
    expect(lastConnectParams().get('host')).toBe('irc.test.net');
  });

  it('resumes the session on reconnect and keeps what was negotiated', async () => {
    network.ircConnect(server, 'tester');
    gatewaySession.rememberGatewaySession('token-1');
    gatewaySession.noteGatewaySeq('12');

    await network.ircReconnect();

    expect(lastConnectParams().get('resume')).toBe('token-1');
    expect(lastConnectParams().get('since')).toBe('12');
    expect(mockResetCapabilityState).not.toHaveBeenCalled();
    expect(mockSendDirectRaw).not.toHaveBeenCalledWith(expect.stringMatching(/^QUIT/));
  });

  it('resumes a session moved to TLS by STS on the port it was upgraded to', async () => {
    settingsServer = plaintextServer;
    network.ircConnectWithTLS(plaintextServer, 'tester', 6697);
    gatewaySession.rememberGatewaySession('token-1');

    await network.ircReconnect();

    expect(lastConnectParams().get('resume')).toBe('token-1');
    expect(lastConnectParams().get('port')).toBe('6697');
    expect(lastConnectParams().get('tls')).toBe('true');
  });

  it('keeps the connection host and TLS when it resets negotiated state for a fresh registration', async () => {
    const sts = await import('../sts');
    network.ircConnect(server, 'tester');

    network.resetConnectionState();

    expect(sts.getCurrentConnectionHost()).toBe('irc.test.net');
    expect(sts.isCurrentConnectionSecure()).toBe(true);
  });

  it('starts over on reconnect when it holds no session', async () => {
    await network.ircReconnect();

    expect(lastConnectParams().get('session')).toBe('true');
    expect(mockResetCapabilityState).toHaveBeenCalled();
  });

  it('quits the session on an explicit disconnect so the gateway does not keep it', () => {
    network.ircConnect(server, 'tester');
    gatewaySession.rememberGatewaySession('token-1');

    network.ircDisconnect();

    expect(mockSendDirectRaw).toHaveBeenCalledWith('QUIT :bye');
    expect(mockSendDirectRaw.mock.invocationCallOrder[0]).toBeLessThan(mockDisconnectDirect.mock.invocationCallOrder[0] ?? 0);
    expect(gatewaySession.hasGatewaySession()).toBe(false);

    network.ircConnect(server, 'tester');
    expect(lastConnectParams().has('replace')).toBe(false);
  });

  it('does not send QUIT on a disconnect without a session', () => {
    network.ircDisconnect();

    expect(mockSendDirectRaw).not.toHaveBeenCalled();
  });

  it('keeps per-connection state over an inactivity reconnect that can resume the session', async () => {
    vi.useFakeTimers();
    const tornDown = vi.fn();
    network.onConnectionTornDown(tornDown);
    network.ircConnect(server, 'tester');
    gatewaySession.rememberGatewaySession('token-1');

    network.resetInactivityTimeout();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(mockDisconnectDirect).toHaveBeenCalled();
    expect(tornDown).not.toHaveBeenCalled();
  });

  it('tears per-connection state down on an inactivity reconnect without a session', async () => {
    vi.useFakeTimers();
    const tornDown = vi.fn();
    network.onConnectionTornDown(tornDown);

    network.resetInactivityTimeout();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(tornDown).toHaveBeenCalled();
  });

  it('ends the session a reloaded page left behind', () => {
    sessionStorage.setItem('sic-gateway-session', 'before-reload');

    network.ircConnect(server, 'tester');

    expect(lastConnectParams().get('replace')).toBe('before-reload');
  });
});
