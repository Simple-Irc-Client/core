import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveServerFromParams, isKnownServerParam } from '../resolveServerFromParams';
import * as queryParams from '../queryParams';

vi.mock('../queryParams', () => ({
  getServerParam: vi.fn(() => undefined),
  getPortParam: vi.fn(() => undefined),
  getTlsParam: vi.fn(() => undefined),
}));

vi.mock('@/network/irc/servers', () => ({
  servers: [
    { network: 'Libera.Chat', connectionType: 'backend', default: 0, encoding: 'utf8', servers: ['irc.libera.chat'], tls: true },
    { network: 'OFTC', connectionType: 'backend', default: 0, encoding: 'utf8', servers: ['irc.oftc.net'], tls: false },
  ],
}));

describe('resolveServerFromParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queryParams.getServerParam).mockReturnValue(undefined);
    vi.mocked(queryParams.getPortParam).mockReturnValue(undefined);
    vi.mocked(queryParams.getTlsParam).mockReturnValue(undefined);
  });

  describe('when no server param', () => {
    it('should return undefined when no server param exists', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue(undefined);

      expect(resolveServerFromParams()).toBeUndefined();
    });
  });

  describe('when server param matches known network', () => {
    it('should return matched server for known network', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('Libera.Chat');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ network: 'Libera.Chat' }));
    });

    it('should match server param case-insensitively', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('libera.chat');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ network: 'Libera.Chat' }));
    });

    it('should override TLS for known network when tls param is provided', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('Libera.Chat');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(false);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ network: 'Libera.Chat', tls: false }));
    });

    it('should keep original TLS when tls param is not provided', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('Libera.Chat');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(undefined);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ network: 'Libera.Chat', tls: true }));
    });

    it('should not use port param for known networks', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('Libera.Chat');
      vi.mocked(queryParams.getPortParam).mockReturnValue(7000);

      const result = resolveServerFromParams();

      // Port param is ignored for known networks - they use their own server list
      expect(result).toEqual(expect.objectContaining({ servers: ['irc.libera.chat'] }));
    });
  });

  describe('when server param is custom hostname', () => {
    it('should create custom server for unknown hostname', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');

      const result = resolveServerFromParams();

      expect(result).toEqual({
        connectionType: 'backend',
        default: 0,
        encoding: 'utf8',
        network: 'irc.custom.net',
        servers: ['irc.custom.net'],
        tls: false,
      });
    });

    it('should include port in server address when port param is provided', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');
      vi.mocked(queryParams.getPortParam).mockReturnValue(7000);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ servers: ['irc.custom.net:7000'] }));
    });

    it('should enable TLS when tls param is true', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(true);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ tls: true }));
    });

    it('should disable TLS when tls param is false', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(false);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ tls: false }));
    });

    it('should default TLS to false when tls param is not provided', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(undefined);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({ tls: false }));
    });

    it('should use port and TLS together', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');
      vi.mocked(queryParams.getPortParam).mockReturnValue(6697);
      vi.mocked(queryParams.getTlsParam).mockReturnValue(true);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        servers: ['irc.custom.net:6697'],
        tls: true,
      }));
    });

    it('should parse port from server:port format', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net:7000');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.custom.net',
        servers: ['irc.custom.net:7000'],
      }));
    });

    it('should prefer port param over embedded port', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net:7000');
      vi.mocked(queryParams.getPortParam).mockReturnValue(8000);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        servers: ['irc.custom.net:8000'],
      }));
    });

    it('should handle server:port format with TLS', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net:6697');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(true);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        servers: ['irc.custom.net:6697'],
        tls: true,
      }));
    });

    it('should ignore invalid port in server:port format', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net:invalid');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.custom.net:invalid',
        servers: ['irc.custom.net:invalid'],
      }));
    });

    it('should ignore out-of-range port in server:port format', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net:99999');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.custom.net:99999',
        servers: ['irc.custom.net:99999'],
      }));
    });
  });

  describe('isKnownServerParam', () => {
    it('should return true when no server param', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue(undefined);
      expect(isKnownServerParam()).toBe(true);
    });

    it('should return true for known network', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('Libera.Chat');
      expect(isKnownServerParam()).toBe(true);
    });

    it('should return true for known network case-insensitively', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('libera.chat');
      expect(isKnownServerParam()).toBe(true);
    });

    it('should return false for unknown hostname', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom.net');
      expect(isKnownServerParam()).toBe(false);
    });

    it('should return false for unknown hostname with protocol', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ircs://irc.custom.net:6697');
      expect(isKnownServerParam()).toBe(false);
    });
  });

  describe('protocol prefixes', () => {
    it('should parse ircs:// as TLS backend connection', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ircs://irc.secure.com:6697');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.secure.com',
        servers: ['irc.secure.com:6697'],
        tls: true,
        connectionType: 'backend',
      }));
    });

    it('should parse irc:// as non-TLS backend connection', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc://irc.example.com:6667');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.example.com',
        servers: ['irc.example.com:6667'],
        tls: false,
        connectionType: 'backend',
      }));
    });

    it('should parse wss:// as TLS websocket connection', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('wss://irc.websocket.com:443');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.websocket.com',
        servers: ['irc.websocket.com:443'],
        tls: true,
        connectionType: 'websocket',
        websocketUrl: 'wss://irc.websocket.com:443/',
      }));
    });

    it('should parse ws:// as non-TLS websocket connection', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ws://irc.websocket.com:8080');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.websocket.com',
        servers: ['irc.websocket.com:8080'],
        tls: false,
        connectionType: 'websocket',
        websocketUrl: 'ws://irc.websocket.com:8080/',
      }));
    });

    it('should handle protocol prefix without port', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ircs://irc.secure.com');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.secure.com',
        servers: ['irc.secure.com'],
        tls: true,
      }));
    });

    it('should handle trailing slash in URL', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('wss://irc.websocket.com/');

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        network: 'irc.websocket.com',
        websocketUrl: 'wss://irc.websocket.com/',
      }));
    });

    it('should allow tls param to override protocol TLS setting', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ircs://irc.secure.com:6697');
      vi.mocked(queryParams.getTlsParam).mockReturnValue(false);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        tls: false,
      }));
    });

    it('should allow port param to override protocol port', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ircs://irc.secure.com:6697');
      vi.mocked(queryParams.getPortParam).mockReturnValue(7000);

      const result = resolveServerFromParams();

      expect(result).toEqual(expect.objectContaining({
        servers: ['irc.secure.com:7000'],
      }));
    });
  });

  describe('SSRF protection for custom servers', () => {
    it('should block localhost', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('localhost');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block 127.0.0.1', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('127.0.0.1');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block 10.x.x.x private range', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('10.0.0.1:6667');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block 192.168.x.x private range', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('192.168.1.1');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block 172.16.x.x private range', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('172.16.0.1');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block ::1 IPv6 loopback', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('[::1]');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block 0.0.0.0', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('0.0.0.0');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should allow public server addresses', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('irc.custom-server.org');
      const result = resolveServerFromParams();
      expect(result).toBeDefined();
      expect(result?.network).toBe('irc.custom-server.org');
    });

    it('should block private host with protocol prefix', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('ircs://127.0.0.1:6697');
      expect(resolveServerFromParams()).toBeUndefined();
    });

    it('should block private host via websocket prefix', () => {
      vi.mocked(queryParams.getServerParam).mockReturnValue('wss://192.168.1.1:8080');
      expect(resolveServerFromParams()).toBeUndefined();
    });
  });
});
