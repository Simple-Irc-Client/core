import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock encryption module before importing sasl
const mockIsEncryptionAvailable = vi.fn().mockReturnValue(true);
const mockInitSessionEncryption = vi.fn().mockResolvedValue(undefined);
const mockEncryptString = vi.fn().mockImplementation((str: string) => Promise.resolve(`encrypted:${str}`));
const mockDecryptString = vi.fn().mockImplementation((str: string) => Promise.resolve(str.replace('encrypted:', '')));

vi.mock('@/network/encryption', () => ({
  isEncryptionAvailable: () => mockIsEncryptionAvailable(),
  initSessionEncryption: () => mockInitSessionEncryption(),
  encryptString: (str: string) => mockEncryptString(str),
  decryptString: (str: string) => mockDecryptString(str),
}));

import {
  encodeSaslPlain,
  chunkSaslPayload,
  handleSaslChallenge,
  getSaslState,
  setSaslState,
  setSaslCredentials,
  clearSaslCredentials,
  getSaslAccount,
  getSaslPassword,
  getAuthenticatedAccount,
  setAuthenticatedAccount,
  resetSaslState,
  isSaslInProgress,
  isSaslComplete,
  getNickServFallbackCredentials,
  saveSaslCredentialsForReconnect,
  restoreSaslCredentials,
  clearSavedCredentials,
} from '../sasl';

describe('sasl', () => {
  beforeEach(() => {
    resetSaslState();
    clearSaslCredentials();
    clearSavedCredentials();
    mockIsEncryptionAvailable.mockReturnValue(true);
    mockInitSessionEncryption.mockClear();
    mockEncryptString.mockClear().mockImplementation((str: string) => Promise.resolve(`encrypted:${str}`));
    mockDecryptString.mockClear().mockImplementation((str: string) => Promise.resolve(str.replace('encrypted:', '')));
  });

  describe('encodeSaslPlain', () => {
    it('should encode credentials correctly', () => {
      // PLAIN format: [authzid] NUL authcid NUL passwd
      // Base64 of "\0testuser\0testpass"
      const encoded = encodeSaslPlain('testuser', 'testpass');

      // Decode to verify
      const decoded = atob(encoded);
      expect(decoded).toBe('\0testuser\0testpass');
    });

    it('should handle special characters', () => {
      const encoded = encodeSaslPlain('user@example.com', 'p@ss!word#123');
      const decoded = atob(encoded);
      expect(decoded).toBe('\0user@example.com\0p@ss!word#123');
    });

    it('should support authzid', () => {
      const encoded = encodeSaslPlain('authcid', 'password', 'authzid');
      const decoded = atob(encoded);
      expect(decoded).toBe('authzid\0authcid\0password');
    });

    it('should handle empty authzid by default', () => {
      const encoded = encodeSaslPlain('user', 'pass');
      const decoded = atob(encoded);
      expect(decoded.startsWith('\0')).toBe(true);
    });
  });

  describe('chunkSaslPayload', () => {
    it('should not chunk small payloads', () => {
      const payload = btoa('small');
      const chunks = chunkSaslPayload(payload);
      expect(chunks).toEqual([payload]);
    });

    it('should chunk large payloads at 400 bytes', () => {
      // Create a payload larger than 400 bytes
      const largeString = 'a'.repeat(500);
      const chunks = chunkSaslPayload(largeString);

      expect(chunks.length).toBe(2);
      expect(chunks[0]?.length).toBe(400);
      expect(chunks[1]?.length).toBe(100);
    });

    it('should add + when payload is exactly divisible by 400', () => {
      const exactPayload = 'a'.repeat(400);
      const chunks = chunkSaslPayload(exactPayload);

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe(exactPayload);
      expect(chunks[1]).toBe('+');
    });

    it('should handle empty payload', () => {
      const chunks = chunkSaslPayload('');
      expect(chunks).toEqual(['+']);
    });
  });

  describe('credentials management', () => {
    it('should store and retrieve credentials', () => {
      setSaslCredentials('myaccount', 'mypassword');

      expect(getSaslAccount()).toBe('myaccount');
      expect(getSaslPassword()).toBe('mypassword');
    });

    it('should clear credentials', () => {
      setSaslCredentials('account', 'password');
      clearSaslCredentials();

      expect(getSaslAccount()).toBeNull();
      expect(getSaslPassword()).toBeNull();
    });

    it('should clear plaintext credentials when SASL succeeds', () => {
      setSaslCredentials('account', 'password');
      setSaslState('success');

      expect(getSaslAccount()).toBeNull();
      expect(getSaslPassword()).toBeNull();
    });

    it('should clear plaintext credentials when SASL fails', () => {
      setSaslCredentials('account', 'password');
      setSaslState('failed');

      expect(getSaslAccount()).toBeNull();
      expect(getSaslPassword()).toBeNull();
    });
  });

  describe('SASL state management', () => {
    it('should track state transitions', () => {
      expect(getSaslState()).toBe('none');

      setSaslState('requested');
      expect(getSaslState()).toBe('requested');

      setSaslState('authenticating');
      expect(getSaslState()).toBe('authenticating');

      setSaslState('success');
      expect(getSaslState()).toBe('success');
    });

    it('should track authenticated account', () => {
      expect(getAuthenticatedAccount()).toBeNull();

      setAuthenticatedAccount('myaccount');
      expect(getAuthenticatedAccount()).toBe('myaccount');

      setAuthenticatedAccount(null);
      expect(getAuthenticatedAccount()).toBeNull();
    });

    it('should reset state correctly', () => {
      setSaslState('success');
      setAuthenticatedAccount('account');

      resetSaslState();

      expect(getSaslState()).toBe('none');
      expect(getAuthenticatedAccount()).toBeNull();
    });
  });

  describe('isSaslInProgress', () => {
    it('should return true when requested', () => {
      setSaslState('requested');
      expect(isSaslInProgress()).toBe(true);
    });

    it('should return true when authenticating', () => {
      setSaslState('authenticating');
      expect(isSaslInProgress()).toBe(true);
    });

    it('should return false for other states', () => {
      expect(isSaslInProgress()).toBe(false);

      setSaslState('success');
      expect(isSaslInProgress()).toBe(false);

      setSaslState('failed');
      expect(isSaslInProgress()).toBe(false);
    });
  });

  describe('isSaslComplete', () => {
    it('should return true when success', () => {
      setSaslState('success');
      expect(isSaslComplete()).toBe(true);
    });

    it('should return true when failed', () => {
      setSaslState('failed');
      expect(isSaslComplete()).toBe(true);
    });

    it('should return false for other states', () => {
      expect(isSaslComplete()).toBe(false);

      setSaslState('requested');
      expect(isSaslComplete()).toBe(false);

      setSaslState('authenticating');
      expect(isSaslComplete()).toBe(false);
    });
  });

  describe('handleSaslChallenge', () => {
    it('should return credentials for PLAIN mechanism with + challenge', () => {
      setSaslCredentials('testuser', 'testpass');

      const response = handleSaslChallenge('+', 'PLAIN');

      expect(response).not.toBeNull();
      expect(response).toHaveLength(1);
      // Verify the response is base64 encoded credentials
      const decoded = atob(response?.[0] ?? '');
      expect(decoded).toBe('\0testuser\0testpass');
    });

    it('should return null when no credentials stored', () => {
      const response = handleSaslChallenge('+', 'PLAIN');
      expect(response).toBeNull();
    });

    it('should return null for unknown mechanism', () => {
      setSaslCredentials('user', 'pass');

      // Cast to test unknown mechanism
      const response = handleSaslChallenge('+', 'UNKNOWN' as 'PLAIN');
      expect(response).toBeNull();
    });

    it('should return null for non-+ challenge in PLAIN', () => {
      setSaslCredentials('user', 'pass');

      const response = handleSaslChallenge('some-challenge', 'PLAIN');
      expect(response).toBeNull();
    });
  });

  describe('saveSaslCredentialsForReconnect', () => {
    it('should encrypt and save credentials', async () => {
      setSaslCredentials('myaccount', 'mypassword');

      await saveSaslCredentialsForReconnect();

      expect(mockEncryptString).toHaveBeenCalledWith('myaccount');
      expect(mockEncryptString).toHaveBeenCalledWith('mypassword');
    });

    it('should not save when credentials are null', async () => {
      await saveSaslCredentialsForReconnect();

      expect(mockEncryptString).not.toHaveBeenCalled();
    });

    it('should initialize session encryption when not available', async () => {
      mockIsEncryptionAvailable.mockReturnValue(false);
      setSaslCredentials('account', 'password');

      await saveSaslCredentialsForReconnect();

      expect(mockInitSessionEncryption).toHaveBeenCalled();
    });

    it('should not initialize session encryption when already available', async () => {
      mockIsEncryptionAvailable.mockReturnValue(true);
      setSaslCredentials('account', 'password');

      await saveSaslCredentialsForReconnect();

      expect(mockInitSessionEncryption).not.toHaveBeenCalled();
    });

    it('should capture credentials synchronously before awaiting encryption init', async () => {
      // This tests the race condition fix: saveSaslCredentialsForReconnect captures
      // values into local variables before any await, so even if setSaslState('success')
      // clears the module-level variables during the await, the save still works.
      mockIsEncryptionAvailable.mockReturnValue(false);
      mockInitSessionEncryption.mockImplementation(async () => {
        // Simulate async delay during which credentials get cleared
        await Promise.resolve();
      });

      setSaslCredentials('testuser', 'testpass');

      // Start save (fire-and-forget, like onRaw903 does)
      const savePromise = saveSaslCredentialsForReconnect();

      // Immediately clear credentials (simulates setSaslState('success') running
      // synchronously after the fire-and-forget save call)
      setSaslState('success');

      // Verify credentials were cleared by setSaslState
      expect(getSaslAccount()).toBeNull();
      expect(getSaslPassword()).toBeNull();

      // Wait for save to complete
      await savePromise;

      // Despite credentials being cleared, save should have captured values beforehand
      expect(mockEncryptString).toHaveBeenCalledWith('testuser');
      expect(mockEncryptString).toHaveBeenCalledWith('testpass');
    });
  });

  describe('restoreSaslCredentials', () => {
    it('should decrypt and restore saved credentials', async () => {
      setSaslCredentials('account', 'password');
      await saveSaslCredentialsForReconnect();

      // Clear plaintext credentials (simulates what setSaslState('success') does)
      clearSaslCredentials();
      expect(getSaslAccount()).toBeNull();

      const result = await restoreSaslCredentials();

      expect(result).toBe(true);
      expect(getSaslAccount()).toBe('account');
      expect(getSaslPassword()).toBe('password');
    });

    it('should return false when no saved credentials exist', async () => {
      const result = await restoreSaslCredentials();

      expect(result).toBe(false);
      expect(getSaslAccount()).toBeNull();
    });

    it('should return false when encryption is not available', async () => {
      setSaslCredentials('account', 'password');
      await saveSaslCredentialsForReconnect();
      clearSaslCredentials();

      mockIsEncryptionAvailable.mockReturnValue(false);

      const result = await restoreSaslCredentials();

      expect(result).toBe(false);
    });

    it('should return false when decryption fails', async () => {
      setSaslCredentials('account', 'password');
      await saveSaslCredentialsForReconnect();
      clearSaslCredentials();

      mockDecryptString.mockRejectedValue(new Error('Decryption failed'));

      const result = await restoreSaslCredentials();

      expect(result).toBe(false);
      expect(getSaslAccount()).toBeNull();
    });
  });

  describe('clearSavedCredentials', () => {
    it('should prevent restore after clearing', async () => {
      setSaslCredentials('account', 'password');
      await saveSaslCredentialsForReconnect();
      clearSaslCredentials();

      clearSavedCredentials();

      const result = await restoreSaslCredentials();
      expect(result).toBe(false);
    });
  });

  describe('full reconnection credential cycle', () => {
    it('should save on SASL success, survive state reset, and restore on reconnect', async () => {
      // 1. Initial SASL: set credentials and authenticate
      setSaslCredentials('Merovingian', 'secret123');

      // 2. SASL succeeds: save (fire-and-forget) then clear credentials
      const savePromise = saveSaslCredentialsForReconnect();
      setSaslState('success');
      await savePromise;

      // Plaintext credentials are gone
      expect(getSaslAccount()).toBeNull();
      expect(getSaslPassword()).toBeNull();

      // 3. Disconnect: reset SASL state (like ircReconnect does)
      resetSaslState();
      expect(getSaslState()).toBe('none');

      // 4. Reconnect: restore credentials
      const restored = await restoreSaslCredentials();
      expect(restored).toBe(true);
      expect(getSaslAccount()).toBe('Merovingian');
      expect(getSaslPassword()).toBe('secret123');

      // 5. NickServ fallback should work with restored credentials
      const fallback = getNickServFallbackCredentials();
      expect(fallback).toEqual({ account: 'Merovingian', password: 'secret123' });
    });

    it('should support multiple reconnect cycles', async () => {
      setSaslCredentials('user', 'pass');

      // First save
      await saveSaslCredentialsForReconnect();
      setSaslState('success');

      // First reconnect
      resetSaslState();
      const restored1 = await restoreSaslCredentials();
      expect(restored1).toBe(true);

      // Second SASL success with restored credentials
      await saveSaslCredentialsForReconnect();
      setSaslState('success');

      // Second reconnect
      resetSaslState();
      const restored2 = await restoreSaslCredentials();
      expect(restored2).toBe(true);
      expect(getSaslAccount()).toBe('user');
      expect(getSaslPassword()).toBe('pass');
    });
  });

  describe('getNickServFallbackCredentials', () => {
    it('should return credentials when SASL was not used', () => {
      setSaslCredentials('testaccount', 'testpassword');
      // SASL state is 'none' by default after reset

      const result = getNickServFallbackCredentials();

      expect(result).toEqual({ account: 'testaccount', password: 'testpassword' });
    });

    it('should return null when SASL failed (credentials cleared from memory)', () => {
      setSaslCredentials('testaccount', 'testpassword');
      setSaslState('failed');

      const result = getNickServFallbackCredentials();

      // Plaintext credentials are cleared when SASL completes (success or failed)
      expect(result).toBeNull();
    });

    it('should return null when SASL succeeded', () => {
      setSaslCredentials('testaccount', 'testpassword');
      setSaslState('success');

      const result = getNickServFallbackCredentials();

      expect(result).toBeNull();
    });

    it('should return null when no credentials are stored', () => {
      // No credentials set

      const result = getNickServFallbackCredentials();

      expect(result).toBeNull();
    });

    it('should return null when only account is set', () => {
      setSaslCredentials('testaccount', '');

      const result = getNickServFallbackCredentials();

      expect(result).toBeNull();
    });
  });
});
