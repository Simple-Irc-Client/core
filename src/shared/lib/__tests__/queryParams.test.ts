import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getServerParam, getPortParam, getTlsParam, getChannelParam } from '../queryParams';

describe('queryParams', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  const mockLocation = (search: string, hash = '') => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, search, hash },
    });
  };

  describe('getServerParam', () => {
    it('should return undefined when no server param exists', () => {
      mockLocation('');

      expect(getServerParam()).toBeUndefined();
    });

    it('should return undefined when search has other params but no server', () => {
      mockLocation('?foo=bar&baz=qux');

      expect(getServerParam()).toBeUndefined();
    });

    it('should return the server param value', () => {
      mockLocation('?server=Libera.Chat');

      expect(getServerParam()).toBe('Libera.Chat');
    });

    it('should return the server param with special characters', () => {
      mockLocation('?server=irc.example.com');

      expect(getServerParam()).toBe('irc.example.com');
    });

    it('should handle URL-encoded server param', () => {
      mockLocation('?server=Libera%2EChat');

      expect(getServerParam()).toBe('Libera.Chat');
    });

    it('should return server param when multiple params exist', () => {
      mockLocation('?server=Libera.Chat&channel=%23general');

      expect(getServerParam()).toBe('Libera.Chat');
    });
  });

  describe('getPortParam', () => {
    it('should return undefined when no port param exists', () => {
      mockLocation('');

      expect(getPortParam()).toBeUndefined();
    });

    it('should return undefined when port is not a number', () => {
      mockLocation('?port=abc');

      expect(getPortParam()).toBeUndefined();
    });

    it('should return undefined when port is zero', () => {
      mockLocation('?port=0');

      expect(getPortParam()).toBeUndefined();
    });

    it('should return undefined when port is negative', () => {
      mockLocation('?port=-1');

      expect(getPortParam()).toBeUndefined();
    });

    it('should return undefined when port exceeds 65535', () => {
      mockLocation('?port=65536');

      expect(getPortParam()).toBeUndefined();
    });

    it('should return the port param value', () => {
      mockLocation('?port=6667');

      expect(getPortParam()).toBe(6667);
    });

    it('should return port for TLS connections', () => {
      mockLocation('?port=6697');

      expect(getPortParam()).toBe(6697);
    });

    it('should return port when multiple params exist', () => {
      mockLocation('?server=irc.example.com&port=7000&tls=true');

      expect(getPortParam()).toBe(7000);
    });
  });

  describe('getTlsParam', () => {
    it('should return undefined when no tls param exists', () => {
      mockLocation('');

      expect(getTlsParam()).toBeUndefined();
    });

    it('should return true when tls=true', () => {
      mockLocation('?tls=true');

      expect(getTlsParam()).toBe(true);
    });

    it('should return true when tls=1', () => {
      mockLocation('?tls=1');

      expect(getTlsParam()).toBe(true);
    });

    it('should return false when tls=false', () => {
      mockLocation('?tls=false');

      expect(getTlsParam()).toBe(false);
    });

    it('should return false when tls=0', () => {
      mockLocation('?tls=0');

      expect(getTlsParam()).toBe(false);
    });

    it('should return undefined for invalid tls value', () => {
      mockLocation('?tls=yes');

      expect(getTlsParam()).toBeUndefined();
    });

    it('should return tls when multiple params exist', () => {
      mockLocation('?server=irc.example.com&port=6697&tls=true');

      expect(getTlsParam()).toBe(true);
    });
  });

  describe('getChannelParam', () => {
    it('should return undefined when no channel param exists', () => {
      mockLocation('');

      expect(getChannelParam()).toBeUndefined();
    });

    it('should return undefined when search has other params but no channel', () => {
      mockLocation('?server=Libera.Chat');

      expect(getChannelParam()).toBeUndefined();
    });

    it('should return array with single channel when URL-encoded', () => {
      mockLocation('?channel=%23general');

      expect(getChannelParam()).toEqual(['#general']);
    });

    it('should return channel param when multiple params exist', () => {
      mockLocation('?server=Libera.Chat&channel=%23testing');

      expect(getChannelParam()).toEqual(['#testing']);
    });

    it('should handle channel without hash prefix', () => {
      mockLocation('?channel=general');

      expect(getChannelParam()).toEqual(['general']);
    });

    describe('multiple channels', () => {
      it('should split multiple channels by comma', () => {
        mockLocation('?channel=%23general,%23help,%23random');

        expect(getChannelParam()).toEqual(['#general', '#help', '#random']);
      });

      it('should trim whitespace from channel names', () => {
        mockLocation('?channel=%23general%20,%20%23help');

        expect(getChannelParam()).toEqual(['#general', '#help']);
      });

      it('should filter out empty channel names', () => {
        mockLocation('?channel=%23general,,%23help,');

        expect(getChannelParam()).toEqual(['#general', '#help']);
      });

      it('should return undefined for empty channel list', () => {
        mockLocation('?channel=,,,');

        expect(getChannelParam()).toBeUndefined();
      });
    });

    describe('hash fallback', () => {
      it('should return hash when channel param is empty and hash exists', () => {
        mockLocation('?channel=', '#general');

        expect(getChannelParam()).toEqual(['#general']);
      });

      it('should return hash when channel= is in URL followed by hash', () => {
        mockLocation('?server=Libera.Chat&channel=', '#testing');

        expect(getChannelParam()).toEqual(['#testing']);
      });

      it('should not return hash when channel param is not in URL', () => {
        mockLocation('?server=Libera.Chat', '#general');

        expect(getChannelParam()).toBeUndefined();
      });

      it('should prefer channel param over hash when both have values', () => {
        mockLocation('?channel=%23main', '#other');

        expect(getChannelParam()).toEqual(['#main']);
      });
    });
  });
});
