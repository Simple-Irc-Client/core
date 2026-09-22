/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the Tauri IRC transport.
 *
 * The bug this guards against: events were forwarded over Tauri's global
 * event bus (`app.emit` + `listen`), and the renderer could only `listen`
 * AFTER the `irc_connect` invoke resolved. Anything the Rust driver emitted
 * before that — `socketConnected`, the registration burst, and crucially
 * `connected` — was dropped, leaving the app empty even though sending
 * worked. The fix passes a frontend-created `Channel` into the command so
 * the sink exists before the driver produces a single event.
 *
 * The "delivered before irc_connect resolves" test below is the one that
 * fails against the old emit/listen design and passes with the Channel.
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Server } from '../servers';

// Mock helpers so parseServer is deterministic.
vi.mock('../helpers', () => ({
  parseServer: vi.fn((server: Server) => {
    const serverStr = server.servers?.[0];
    if (!serverStr) return undefined;
    const [host, portPart] = serverStr.split(':');
    return {
      host,
      port: portPart ? Number.parseInt(portPart, 10) : undefined,
      tls: server.tls ?? false,
    };
  }),
}));

// Minimal stand-in for @tauri-apps/api/core's Channel: records the handler
// the transport assigns and lets the test push messages through it, the
// same way the Rust `Channel::send` would.
type ChannelMessage = Record<string, unknown>;

class MockChannel {
  onmessage: ((msg: ChannelMessage) => void) | null = null;

  emit(msg: ChannelMessage): void {
    this.onmessage?.(msg);
  }
}

let lastChannel: MockChannel | null = null;
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  // Must be a `function` (not an arrow): production calls `new Channel()`,
  // and a constructor returning an object yields that object — so production
  // gets a MockChannel to wire `onmessage` on.
  Channel: vi.fn(function ChannelMock() {
    lastChannel = new MockChannel();
    return lastChannel;
  }),
}));

const baseServer: Server = {
  default: 0,
  encoding: 'utf8',
  network: 'TestNet',
  servers: ['irc.example.com:6667'],
  tls: false,
};

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('tauriTransport', () => {
  let transport: typeof import('../tauriTransport');
  let eventCallback: Mock;

  beforeEach(async () => {
    vi.resetModules();
    lastChannel = null;
    mockInvoke.mockReset();
    eventCallback = vi.fn();
    transport = await import('../tauriTransport');
    transport.setTauriEventCallback(eventCallback);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes a Channel into irc_connect and wires its onmessage handler', async () => {
    mockInvoke.mockResolvedValue('conn-1');

    transport.initTauriIrc(baseServer);
    await flush();

    expect(mockInvoke).toHaveBeenCalledWith(
      'irc_connect',
      expect.objectContaining({ onEvent: expect.anything() }),
    );
    expect(lastChannel).not.toBeNull();
    expect(lastChannel?.onmessage).toBeTypeOf('function');
  });

  // The core regression: the Rust driver emits before `irc_connect` resolves.
  // With the old emit/listen pair these events were lost; with the Channel
  // they must still reach the kernel callback.
  it('delivers events that arrive BEFORE irc_connect resolves', async () => {
    let resolveConnect: (id: string) => void = () => {};
    mockInvoke.mockImplementation((cmd: string, args: { onEvent: MockChannel }) => {
      if (cmd !== 'irc_connect') return Promise.resolve();
      // Simulate the Rust driver pushing its startup burst while the
      // invoke promise is still pending and connectionId is still null.
      args.onEvent.emit({ type: 'socketConnected' });
      args.onEvent.emit({ type: 'raw', line: ':srv 001 TestNick :Welcome' });
      return new Promise<string>((res) => {
        resolveConnect = res;
      });
    });

    transport.initTauriIrc(baseServer);
    await flush();

    // Delivered even though irc_connect has not resolved. Connect is routed
    // through 'sic-irc-event' so the kernel's handleConnect runs; 001 is just a
    // raw line (the kernel derives connected-state from it).
    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'connect' });
    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
      type: 'raw',
      line: ':srv 001 TestNick :Welcome',
    });
    expect(transport.isTauriConnected()).toBe(true);

    resolveConnect('conn-1');
    await flush();
  });

  it('forwards raw lines to the kernel', async () => {
    mockInvoke.mockResolvedValue('conn-1');
    transport.initTauriIrc(baseServer);
    await flush();

    // The driver only emits inbound lines now (no outbound echo), so every raw
    // event is forwarded verbatim.
    lastChannel?.emit({ type: 'raw', line: ':nick!u@h PRIVMSG #chan :hi' });

    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', {
      type: 'raw',
      line: ':nick!u@h PRIVMSG #chan :hi',
    });
  });

  it('maps error to a sic-irc-event and closed resets connection state', async () => {
    mockInvoke.mockResolvedValue('conn-1');
    transport.initTauriIrc(baseServer);
    await flush();

    lastChannel?.emit({ type: 'error', message: 'boom' });
    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'error', line: 'boom' });

    lastChannel?.emit({ type: 'closed' });
    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'close' });
    expect(transport.isTauriConnected()).toBe(false);
    expect(transport.isTauriConnecting()).toBe(false);
  });

  it('routes outbound lines through irc_send with the connection id', async () => {
    mockInvoke.mockResolvedValue('conn-42');
    transport.initTauriIrc(baseServer);
    await flush();

    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(undefined);
    await transport.sendTauriRaw('JOIN #chan');

    expect(mockInvoke).toHaveBeenCalledWith('irc_send', {
      id: 'conn-42',
      line: 'JOIN #chan',
    });
  });

  it('surfaces a connect failure as an error + close', async () => {
    mockInvoke.mockRejectedValue(new Error('connect refused'));
    transport.initTauriIrc(baseServer);
    await flush();

    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'error', line: 'connect refused' });
    expect(eventCallback).toHaveBeenCalledWith('sic-irc-event', { type: 'close' });
    expect(transport.isTauriConnecting()).toBe(false);
  });

  describe('disconnect while irc_connect is in flight', () => {
    // The Rust command spawns the connection before it returns its id, so a
    // disconnect that lands first must neither adopt the late id nor let that
    // connection's events reach the kernel — and must close it on the Rust side.
    let resolveConnect: (id: string) => void;

    beforeEach(() => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'irc_connect') {
          return new Promise<string>((resolve) => { resolveConnect = resolve; });
        }
        return Promise.resolve();
      });
    });

    it('closes the late connection instead of adopting it', async () => {
      transport.initTauriIrc(baseServer);
      transport.disconnectTauriIrc();
      resolveConnect('stale-conn');
      await flush();

      expect(mockInvoke).toHaveBeenCalledWith('irc_disconnect', { id: 'stale-conn' });

      await transport.sendTauriRaw('PING :x');
      expect(mockInvoke).not.toHaveBeenCalledWith('irc_send', expect.anything());
    });

    it('drops events from the superseded connection', async () => {
      transport.initTauriIrc(baseServer);
      const staleChannel = lastChannel;
      transport.disconnectTauriIrc();

      staleChannel?.emit({ type: 'socketConnected' });
      staleChannel?.emit({ type: 'closed' });

      expect(eventCallback).not.toHaveBeenCalled();
      expect(transport.isTauriConnected()).toBe(false);
    });

    it('lets a new connection start and ignores the old one\'s events', async () => {
      transport.initTauriIrc(baseServer);
      const staleChannel = lastChannel;
      transport.disconnectTauriIrc();

      expect(() => transport.initTauriIrc(baseServer)).not.toThrow();
      expect(transport.isTauriConnecting()).toBe(true);

      // A late 'closed' from the first attempt must not reset the second.
      staleChannel?.emit({ type: 'closed' });
      expect(transport.isTauriConnecting()).toBe(true);
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });
});
