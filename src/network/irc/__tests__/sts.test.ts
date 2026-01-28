import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseSTSValue,
  createSTSPolicy,
  setPendingSTSUpgrade,
  getPendingSTSUpgrade,
  clearPendingSTSUpgrade,
  setCurrentConnectionInfo,
  isCurrentConnectionSecure,
  getCurrentConnectionHost,
  incrementSTSRetries,
  resetSTSRetries,
  hasExhaustedSTSRetries,
  resetSTSSessionState,
} from '../sts';

describe('STS (Strict Transport Security)', () => {
  beforeEach(() => {
    clearPendingSTSUpgrade();
    resetSTSRetries();
    resetSTSSessionState();
  });

  describe('parseSTSValue', () => {
    it('should parse valid STS value with port and duration', () => {
      const result = parseSTSValue('port=6697,duration=300');
      expect(result).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    it('should parse STS value with preload flag', () => {
      const result = parseSTSValue('port=6697,duration=86400,preload');
      expect(result).toEqual({
        port: 6697,
        duration: 86400,
        preload: true,
      });
    });

    it('should parse STS value with duration=0 (indefinite)', () => {
      const result = parseSTSValue('port=6697,duration=0');
      expect(result).toEqual({
        port: 6697,
        duration: 0,
        preload: false,
      });
    });

    it('should return null for empty string', () => {
      expect(parseSTSValue('')).toBeNull();
    });

    it('should return null for missing port', () => {
      expect(parseSTSValue('duration=300')).toBeNull();
    });

    it('should return null for missing duration', () => {
      expect(parseSTSValue('port=6697')).toBeNull();
    });

    it('should return null for invalid port', () => {
      expect(parseSTSValue('port=abc,duration=300')).toBeNull();
    });

    it('should return null for invalid duration', () => {
      expect(parseSTSValue('port=6697,duration=abc')).toBeNull();
    });

    it('should return null for negative port', () => {
      expect(parseSTSValue('port=-1,duration=300')).toBeNull();
    });

    it('should return null for negative duration', () => {
      expect(parseSTSValue('port=6697,duration=-1')).toBeNull();
    });
  });

  describe('parseSTSValue fuzzy tests', () => {
    // Malformed delimiters
    it('should handle extra commas', () => {
      expect(parseSTSValue('port=6697,,duration=300')).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    it('should handle trailing comma', () => {
      expect(parseSTSValue('port=6697,duration=300,')).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    it('should handle leading comma', () => {
      expect(parseSTSValue(',port=6697,duration=300')).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    // Parameter ordering
    it('should handle different parameter order', () => {
      expect(parseSTSValue('duration=300,port=6697')).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    it('should handle preload in middle', () => {
      expect(parseSTSValue('port=6697,preload,duration=300')).toEqual({
        port: 6697,
        duration: 300,
        preload: true,
      });
    });

    // Whitespace (should not be present in valid STS, but test robustness)
    it('should return null for values with spaces in key', () => {
      expect(parseSTSValue('port = 6697,duration=300')).toBeNull();
    });

    it('should handle port with leading space (parseInt trims)', () => {
      // parseInt(' 6697') = 6697 (leading whitespace is trimmed)
      const result = parseSTSValue('port= 6697,duration=300');
      expect(result?.port).toBe(6697);
    });

    // Large numbers
    it('should handle large port numbers', () => {
      expect(parseSTSValue('port=65535,duration=300')).toEqual({
        port: 65535,
        duration: 300,
        preload: false,
      });
    });

    it('should handle very large duration', () => {
      expect(parseSTSValue('port=6697,duration=31536000')).toEqual({
        port: 6697,
        duration: 31536000, // 1 year in seconds
        preload: false,
      });
    });

    it('should handle port exceeding safe integer (parseInt behavior)', () => {
      // parseInt handles huge numbers by returning a large float
      // This documents actual behavior - validation could be added elsewhere if needed
      const result = parseSTSValue('port=99999999999999999999,duration=300');
      expect(result).not.toBeNull();
      expect(result?.port).toBeGreaterThan(0);
    });

    // Empty and null-like values
    it('should return null for port with empty value', () => {
      expect(parseSTSValue('port=,duration=300')).toBeNull();
    });

    it('should return null for duration with empty value', () => {
      expect(parseSTSValue('port=6697,duration=')).toBeNull();
    });

    it('should return null for only equals signs', () => {
      expect(parseSTSValue('=,=')).toBeNull();
    });

    it('should return null for just commas', () => {
      expect(parseSTSValue(',,,')).toBeNull();
    });

    // Duplicate parameters (last one wins in current implementation)
    it('should use last value for duplicate port', () => {
      const result = parseSTSValue('port=6697,duration=300,port=6698');
      expect(result?.port).toBe(6698);
    });

    it('should use last value for duplicate duration', () => {
      const result = parseSTSValue('port=6697,duration=300,duration=600');
      expect(result?.duration).toBe(600);
    });

    // Unknown parameters (should be ignored)
    it('should ignore unknown parameters', () => {
      expect(parseSTSValue('port=6697,duration=300,unknown=value')).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    it('should ignore unknown flags', () => {
      expect(parseSTSValue('port=6697,duration=300,someflag')).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    // Special characters (parseInt stops at non-numeric chars)
    it('should parse port up to special character (parseInt behavior)', () => {
      // parseInt('66$97') = 66 (stops at $)
      const result = parseSTSValue('port=66$97,duration=300');
      expect(result?.port).toBe(66);
    });

    it('should parse duration up to special character (parseInt behavior)', () => {
      // parseInt('30#0') = 30 (stops at #)
      const result = parseSTSValue('port=6697,duration=30#0');
      expect(result?.duration).toBe(30);
    });

    // Float values
    it('should truncate float port to integer', () => {
      const result = parseSTSValue('port=6697.5,duration=300');
      expect(result?.port).toBe(6697);
    });

    it('should truncate float duration to integer', () => {
      const result = parseSTSValue('port=6697,duration=300.9');
      expect(result?.duration).toBe(300);
    });

    // Hex/octal values
    it('should return null for hex port', () => {
      expect(parseSTSValue('port=0x1A29,duration=300')).toBeNull();
    });

    it('should handle octal-like port (parsed as decimal)', () => {
      // parseInt('0777', 10) = 777, not octal
      const result = parseSTSValue('port=0777,duration=300');
      expect(result?.port).toBe(777);
    });

    // Zero port
    it('should return null for port=0', () => {
      expect(parseSTSValue('port=0,duration=300')).toBeNull();
    });

    // Case sensitivity
    it('should handle uppercase PORT (treated as unknown)', () => {
      expect(parseSTSValue('PORT=6697,duration=300')).toBeNull();
    });

    it('should handle uppercase DURATION (treated as unknown)', () => {
      expect(parseSTSValue('port=6697,DURATION=300')).toBeNull();
    });

    it('should handle uppercase PRELOAD (treated as unknown flag)', () => {
      const result = parseSTSValue('port=6697,duration=300,PRELOAD');
      expect(result?.preload).toBe(false); // uppercase not recognized
    });

    // Multiple equals in value
    it('should handle multiple equals in value', () => {
      // 'port=6697=extra' splits to ['port', '6697=extra'], parseInt('6697=extra') = 6697
      const result = parseSTSValue('port=6697=extra,duration=300');
      expect(result?.port).toBe(6697);
    });

    // Unicode
    it('should return null for unicode in port', () => {
      expect(parseSTSValue('port=６６９７,duration=300')).toBeNull(); // fullwidth digits
    });

    // Very long strings
    it('should handle very long unknown parameter', () => {
      const longValue = 'a'.repeat(10000);
      expect(parseSTSValue(`port=6697,duration=300,${longValue}=test`)).toEqual({
        port: 6697,
        duration: 300,
        preload: false,
      });
    });

    // Newlines and tabs (parseInt stops at these chars)
    it('should parse port up to newline (parseInt behavior)', () => {
      // parseInt('6697\n') = 6697 (stops at newline)
      // The newline becomes part of the next "parameter" which is ignored
      const result = parseSTSValue('port=6697\n,duration=300');
      expect(result?.port).toBe(6697);
    });

    it('should parse port up to tab (parseInt behavior)', () => {
      // parseInt('6697\t') = 6697 (stops at tab)
      const result = parseSTSValue('port=6697\t,duration=300');
      expect(result?.port).toBe(6697);
    });
  });

  describe('createSTSPolicy', () => {
    it('should create policy with expiration', () => {
      const now = Date.now();
      const parsed = { port: 6697, duration: 300, preload: false };
      const policy = createSTSPolicy('irc.example.com', parsed);

      expect(policy.host).toBe('irc.example.com');
      expect(policy.port).toBe(6697);
      expect(policy.duration).toBe(300);
      expect(policy.preload).toBe(false);
      // expiresAt should be approximately now + 300 seconds
      expect(policy.expiresAt).toBeGreaterThanOrEqual(now + 300 * 1000 - 100);
      expect(policy.expiresAt).toBeLessThanOrEqual(now + 300 * 1000 + 100);
    });

    it('should create policy with indefinite expiration for duration=0', () => {
      const parsed = { port: 6697, duration: 0, preload: true };
      const policy = createSTSPolicy('irc.example.com', parsed);

      expect(policy.expiresAt).toBe(0); // 0 means never expires
      expect(policy.preload).toBe(true);
    });

    it('should normalize host to lowercase', () => {
      const parsed = { port: 6697, duration: 300, preload: false };
      const policy = createSTSPolicy('IRC.EXAMPLE.COM', parsed);

      expect(policy.host).toBe('irc.example.com');
    });
  });

  describe('pending STS upgrade', () => {
    it('should initially have no pending upgrade', () => {
      expect(getPendingSTSUpgrade()).toBeNull();
    });

    it('should set and get pending upgrade', () => {
      const upgrade = {
        host: 'irc.example.com',
        port: 6697,
        reason: 'sts_upgrade' as const,
      };
      setPendingSTSUpgrade(upgrade);
      expect(getPendingSTSUpgrade()).toEqual(upgrade);
    });

    it('should clear pending upgrade', () => {
      setPendingSTSUpgrade({
        host: 'irc.example.com',
        port: 6697,
        reason: 'sts_upgrade',
      });
      clearPendingSTSUpgrade();
      expect(getPendingSTSUpgrade()).toBeNull();
    });
  });

  describe('connection info tracking', () => {
    it('should track non-TLS connection', () => {
      setCurrentConnectionInfo('irc.example.com', false);
      expect(isCurrentConnectionSecure()).toBe(false);
      expect(getCurrentConnectionHost()).toBe('irc.example.com');
    });

    it('should track TLS connection', () => {
      setCurrentConnectionInfo('irc.example.com', true);
      expect(isCurrentConnectionSecure()).toBe(true);
      expect(getCurrentConnectionHost()).toBe('irc.example.com');
    });

    it('should normalize host to lowercase', () => {
      setCurrentConnectionInfo('IRC.EXAMPLE.COM', false);
      expect(getCurrentConnectionHost()).toBe('irc.example.com');
    });

    it('should reset session state', () => {
      setCurrentConnectionInfo('irc.example.com', true);
      resetSTSSessionState();
      expect(getCurrentConnectionHost()).toBeNull();
      expect(isCurrentConnectionSecure()).toBe(false);
    });
  });

  describe('STS retry tracking', () => {
    it('should initially not have exhausted retries', () => {
      expect(hasExhaustedSTSRetries()).toBe(false);
    });

    it('should exhaust retries after 3 increments', () => {
      incrementSTSRetries();
      expect(hasExhaustedSTSRetries()).toBe(false);
      incrementSTSRetries();
      expect(hasExhaustedSTSRetries()).toBe(false);
      incrementSTSRetries();
      expect(hasExhaustedSTSRetries()).toBe(true);
    });

    it('should reset retries', () => {
      incrementSTSRetries();
      incrementSTSRetries();
      incrementSTSRetries();
      expect(hasExhaustedSTSRetries()).toBe(true);
      resetSTSRetries();
      expect(hasExhaustedSTSRetries()).toBe(false);
    });
  });
});
