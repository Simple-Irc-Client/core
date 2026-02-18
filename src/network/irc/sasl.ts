/**
 * IRCv3 SASL Authentication
 * https://ircv3.net/specs/extensions/sasl-3.1.html
 * https://ircv3.net/specs/extensions/sasl-3.2.html
 */

import { encryptString, decryptString, isEncryptionAvailable, initSessionEncryption } from '@/network/encryption';

export type SaslMechanism = 'PLAIN' | 'EXTERNAL';

export type SaslState = 'none' | 'requested' | 'authenticating' | 'success' | 'failed';

// SASL state
let saslState: SaslState = 'none';
let saslAccount: string | null = null;
let saslPassword: string | null = null;
let authenticatedAccount: string | null = null;

// Stored encrypted credentials for reconnection
let savedEncryptedAccount: string | null = null;
let savedEncryptedPassword: string | null = null;

/** Get current SASL state */
export const getSaslState = (): SaslState => saslState;

/** Set SASL state — clears plaintext credentials when authentication completes */
export const setSaslState = (state: SaslState): void => {
  saslState = state;

  // Clear plaintext credentials from memory once SASL is complete.
  // Encrypted copies are preserved for reconnection via saveSaslCredentialsForReconnect().
  if (state === 'success' || state === 'failed') {
    saslAccount = null;
    saslPassword = null;
  }
};

/** Get authenticated account name (after successful SASL) */
export const getAuthenticatedAccount = (): string | null => authenticatedAccount;

/** Set authenticated account name */
export const setAuthenticatedAccount = (account: string | null): void => {
  authenticatedAccount = account;
};

/** Store credentials for SASL authentication */
export const setSaslCredentials = (account: string, password: string): void => {
  saslAccount = account;
  saslPassword = password;
};

/** Clear SASL credentials */
export const clearSaslCredentials = (): void => {
  saslAccount = null;
  saslPassword = null;
};

/** Get stored SASL account */
export const getSaslAccount = (): string | null => saslAccount;

/** Get stored SASL password */
export const getSaslPassword = (): string | null => saslPassword;

/** Reset SASL state (on disconnect) */
export const resetSaslState = (): void => {
  saslState = 'none';
  authenticatedAccount = null;
  // Don't clear credentials - they may be reused on reconnect
};

/**
 * Encode SASL PLAIN authentication payload
 * Format: base64(authzid NUL authcid NUL password)
 * For most cases authzid == authcid (the account name)
 *
 * @param account - The account name (authcid)
 * @param password - The account password
 * @param authzid - Authorization identity (usually same as account, or empty)
 * @returns Base64 encoded SASL PLAIN payload
 */
export const encodeSaslPlain = (account: string, password: string, authzid = ''): string => {
  // PLAIN format: [authzid] NUL authcid NUL passwd
  const payload = `${authzid}\0${account}\0${password}`;
  return btoa(payload);
};

/**
 * Chunk a base64 string into 400-byte chunks for AUTHENTICATE
 * IRC has a 512 byte line limit, so we chunk at 400 to leave room for command
 */
export const chunkSaslPayload = (payload: string): string[] => {
  const chunks: string[] = [];
  const chunkSize = 400;

  for (let i = 0; i < payload.length; i += chunkSize) {
    chunks.push(payload.substring(i, i + chunkSize));
  }

  // If payload is exactly divisible by 400, or empty, add '+' to signal end
  if (payload.length === 0 || payload.length % chunkSize === 0) {
    chunks.push('+');
  }

  return chunks;
};

/**
 * Process AUTHENTICATE challenge from server
 * Returns the response to send, or null if authentication should abort
 *
 * @param challenge - The challenge from the server (usually '+' for PLAIN)
 * @param mechanism - The SASL mechanism being used
 * @returns Array of responses to send, or null to abort
 */
export const handleSaslChallenge = (
  challenge: string,
  mechanism: SaslMechanism,
): string[] | null => {
  if (mechanism === 'PLAIN') {
    // For PLAIN, the server sends '+' as the challenge
    // We respond with our base64-encoded credentials
    if (challenge === '+') {
      const account = getSaslAccount();
      const password = getSaslPassword();

      if (!account || !password) {
        // No credentials stored - abort
        return null;
      }

      const payload = encodeSaslPlain(account, password);
      return chunkSaslPayload(payload);
    }
  }

  // Unknown challenge or mechanism - abort
  return null;
};

/**
 * Check if SASL authentication is in progress
 */
export const isSaslInProgress = (): boolean => {
  return saslState === 'requested' || saslState === 'authenticating';
};

/**
 * Check if SASL authentication completed (success or failure)
 */
export const isSaslComplete = (): boolean => {
  return saslState === 'success' || saslState === 'failed';
};

/**
 * Save credentials before disconnect (encrypted for reconnection)
 */
export const saveSaslCredentialsForReconnect = async (): Promise<void> => {
  // Capture values synchronously before any awaits, since setSaslState('success')
  // may clear them while we're awaiting encryption initialization
  const account = saslAccount;
  const password = saslPassword;
  if (account && password) {
    // Ensure session encryption is available
    if (!isEncryptionAvailable()) {
      await initSessionEncryption();
    }
    savedEncryptedAccount = await encryptString(account);
    savedEncryptedPassword = await encryptString(password);
  }
};

/**
 * Restore saved credentials after reconnect (decrypted)
 */
export const restoreSaslCredentials = async (): Promise<boolean> => {
  if (savedEncryptedAccount && savedEncryptedPassword && isEncryptionAvailable()) {
    try {
      saslAccount = await decryptString(savedEncryptedAccount);
      saslPassword = await decryptString(savedEncryptedPassword);
      return true;
    } catch (err) {
      console.error('Failed to restore credentials:', err);
      return false;
    }
  }
  return false;
};

/**
 * Clear saved credentials (after successful reconnect or manual disconnect)
 */
export const clearSavedCredentials = (): void => {
  savedEncryptedAccount = null;
  savedEncryptedPassword = null;
};

/**
 * Check if NickServ fallback authentication is needed.
 * Returns credentials if they exist and SASL wasn't used successfully.
 * Used after reconnection when SASL capability isn't available.
 */
export const getNickServFallbackCredentials = (): { account: string; password: string } | null => {
  // Only provide fallback if SASL wasn't successful and we have credentials
  if (saslState !== 'success' && saslAccount && saslPassword) {
    return { account: saslAccount, password: saslPassword };
  }
  return null;
};
