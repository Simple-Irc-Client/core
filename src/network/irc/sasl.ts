// https://ircv3.net/specs/extensions/sasl-3.1.html, https://ircv3.net/specs/extensions/sasl-3.2.html

import { encryptString, decryptString, isEncryptionAvailable, initSessionEncryption } from '@/network/encryption';

export type SaslMechanism = 'PLAIN' | 'EXTERNAL';

export type SaslState = 'none' | 'requested' | 'authenticating' | 'success' | 'failed';

let saslState: SaslState = 'none';
let saslAccount: string | null = null;
let saslPassword: string | null = null;
let authenticatedAccount: string | null = null;

let savedEncryptedAccount: string | null = null;
let savedEncryptedPassword: string | null = null;

// Tracks an in-flight save so restoreSaslCredentials can await it
let pendingSave: Promise<void> | null = null;

export const getSaslState = (): SaslState => saslState;

export const setSaslState = (state: SaslState): void => {
  saslState = state;

  // Plaintext leaves memory once SASL completes; the encrypted copy survives for reconnects
  if (state === 'success' || state === 'failed') {
    saslAccount = null;
    saslPassword = null;
  }
};

export const getAuthenticatedAccount = (): string | null => authenticatedAccount;

export const setAuthenticatedAccount = (account: string | null): void => {
  authenticatedAccount = account;
};

export const setSaslCredentials = (account: string, password: string): void => {
  saslAccount = account;
  saslPassword = password;
};

export const clearSaslCredentials = (): void => {
  saslAccount = null;
  saslPassword = null;
};

export const getSaslAccount = (): string | null => saslAccount;

export const getSaslPassword = (): string | null => saslPassword;

export const resetSaslState = (): void => {
  saslState = 'none';
  authenticatedAccount = null;
  // Credentials are kept for reconnect
};

/** base64(authzid NUL authcid NUL password) */
export const encodeSaslPlain = (account: string, password: string, authzid = ''): string => {
  const payload = `${authzid}\0${account}\0${password}`;
  return btoa(payload);
};

/** 400-byte AUTHENTICATE chunks, leaving room under the 512-byte line limit. */
export const chunkSaslPayload = (payload: string): string[] => {
  const chunks: string[] = [];
  const chunkSize = 400;

  for (let i = 0; i < payload.length; i += chunkSize) {
    chunks.push(payload.substring(i, i + chunkSize));
  }

  // A trailing '+' ends a payload that's empty or a multiple of 400
  if (payload.length === 0 || payload.length % chunkSize === 0) {
    chunks.push('+');
  }

  return chunks;
};

/** Responses to send, or null to abort. */
export const handleSaslChallenge = (
  challenge: string,
  mechanism: SaslMechanism,
): string[] | null => {
  if (mechanism === 'PLAIN') {
    if (challenge === '+') {
      const account = getSaslAccount();
      const password = getSaslPassword();

      if (!account || !password) {
        return null;
      }

      const payload = encodeSaslPlain(account, password);
      return chunkSaslPayload(payload);
    }
  }

  return null;
};

export const isSaslInProgress = (): boolean => {
  return saslState === 'requested' || saslState === 'authenticating';
};

export const isSaslComplete = (): boolean => {
  return saslState === 'success' || saslState === 'failed';
};

/** Tracks the in-flight save so restoreSaslCredentials can await it even when callers fire-and-forget. */
export const saveSaslCredentialsForReconnect = async (): Promise<void> => {
  // Captured before any await: setSaslState('success') may clear them meanwhile
  const account = saslAccount;
  const password = saslPassword;
  if (account && password) {
    const save = (async () => {
      if (!isEncryptionAvailable()) {
        await initSessionEncryption();
      }
      savedEncryptedAccount = await encryptString(account);
      savedEncryptedPassword = await encryptString(password);
    })();
    pendingSave = save;
    await save;
    pendingSave = null;
  }
};

export const restoreSaslCredentials = async (): Promise<boolean> => {
  if (pendingSave) {
    await pendingSave;
  }
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

export const clearSavedCredentials = (): void => {
  savedEncryptedAccount = null;
  savedEncryptedPassword = null;
};

export const getNickServFallbackCredentials = (): { account: string; password: string } | null => {
  if (saslState !== 'success' && saslAccount && saslPassword) {
    return { account: saslAccount, password: saslPassword };
  }
  return null;
};
