/**
 * AES-GCM nonce length in bytes. 96 bits is the size the GCM spec optimises for.
 *
 * A "nonce" (here also called an IV, initialization vector) is a value that
 * must never repeat under the same key — GCM needs a fresh one per message so
 * that encrypting the same text twice doesn't produce the same ciphertext
 * twice. `sealBytes` below generates one at random for every call.
 */
const IV_LENGTH = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** WebCrypto wants a plain `ArrayBuffer`; a `Uint8Array` view (e.g. from `TextEncoder.encode`) isn't guaranteed to be one. */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
};

/**
 * Encrypt with AES-GCM and pack the result as base64 of `IV ‖ ciphertext ‖ tag`.
 *
 * Shared by every encrypt/decrypt pair in this file, and by `e2ee/crypto.ts`'s
 * `seal`/`open` — same AEAD framing, same nonce handling, one place to get it
 * right. `additionalData` is authenticated but not encrypted; e2ee passes its
 * protocol label there so a ciphertext from a different protocol version
 * can't be replayed as one of its frames, while this file's own callers have
 * no need for it.
 */
export async function sealBytes(key: CryptoKey, plaintext: string, additionalData?: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData && toArrayBuffer(additionalData) },
    key,
    textEncoder.encode(plaintext),
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt a payload `sealBytes` produced. Rejects on a wrong key, a tampered
 * byte, a truncated frame, or a mismatched `additionalData` — GCM
 * authentication makes all of those indistinguishable failures, which is the
 * behaviour callers want: never return plaintext that hasn't been verified.
 */
export async function openBytes(key: CryptoKey, sealedB64: string, additionalData?: Uint8Array): Promise<string> {
  const combined = base64ToBytes(sealedB64);
  if (combined.length <= IV_LENGTH) {
    throw new Error('Sealed payload is too short to contain a nonce');
  }

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: combined.slice(0, IV_LENGTH),
      additionalData: additionalData && toArrayBuffer(additionalData),
    },
    key,
    toArrayBuffer(combined.slice(IV_LENGTH)),
  );

  return textDecoder.decode(decrypted);
}

let cryptoKey: CryptoKey | null = null;

/**
 * Check if encryption is available (key has been initialized)
 */
export function isEncryptionAvailable(): boolean {
  return cryptoKey !== null;
}

/**
 * Initialize encryption with a random session key.
 * Used when backend encryption key isn't configured but encryption is needed.
 */
export async function initSessionEncryption(): Promise<void> {
  if (cryptoKey !== null) return; // Already initialized

  // Generate random 256-bit key for session
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const base64Key = bytesToBase64(rawKey);
  await initEncryption(base64Key);
}

/**
 * Convert base64 to Uint8Array (browser-compatible)
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 (browser-compatible)
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Initialize encryption with a base64-encoded key
 * Key should be 32 bytes (256 bits) encoded as base64
 */
export async function initEncryption(base64Key: string): Promise<void> {
  const keyData = base64ToBytes(base64Key);
  cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a message object to base64 string
 */
export async function encryptMessage(data: unknown): Promise<string> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return sealBytes(cryptoKey, JSON.stringify(data));
}

/**
 * Decrypt a base64 string back to message object
 */
export async function decryptMessage(encryptedBase64: string): Promise<unknown> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return JSON.parse(await openBytes(cryptoKey, encryptedBase64));
}

/**
 * Encrypt a raw string to base64 (no JSON wrapping)
 */
export async function encryptString(data: string): Promise<string> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return sealBytes(cryptoKey, data);
}

/**
 * Decrypt a base64 string back to raw string (no JSON parsing)
 */
export async function decryptString(encryptedBase64: string): Promise<string> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return openBytes(cryptoKey, encryptedBase64);
}

// --- Persistent encryption (key stored in localStorage) ---

const PERSISTENT_KEY_STORAGE = 'sic-ek';
let persistentKey: CryptoKey | null = null;

/**
 * Load or generate a persistent encryption key from localStorage.
 * The key is stored as a base64 string in localStorage['sic-ek'].
 */
export async function initPersistentEncryption(): Promise<void> {
  if (persistentKey !== null) { return; }

  let base64Key = localStorage.getItem(PERSISTENT_KEY_STORAGE);
  if (!base64Key) {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    base64Key = bytesToBase64(rawKey);
    localStorage.setItem(PERSISTENT_KEY_STORAGE, base64Key);
  }

  const keyData = base64ToBytes(base64Key);
  persistentKey = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string using the persistent key
 */
export async function encryptPersistent(data: string): Promise<string> {
  if (!persistentKey) {
    await initPersistentEncryption();
  }

  const key = persistentKey;
  if (!key) {
    throw new Error('Persistent encryption not initialized');
  }

  return sealBytes(key, data);
}

/**
 * Decrypt a string using the persistent key
 */
export async function decryptPersistent(encryptedBase64: string): Promise<string> {
  if (!persistentKey) {
    await initPersistentEncryption();
  }

  const key = persistentKey;
  if (!key) {
    throw new Error('Persistent encryption not initialized');
  }

  return openBytes(key, encryptedBase64);
}

