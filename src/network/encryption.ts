// AES-GCM nonce: 96 bits, random per call, must never repeat under one key
const IV_LENGTH = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// A Uint8Array view isn't guaranteed to be a plain ArrayBuffer, which WebCrypto wants
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
};

/** base64(IV ‖ ciphertext ‖ tag). E2EE passes its protocol label as `additionalData` to block cross-version replay. */
export async function sealBytes(key: CryptoKey, plaintext: string, additionalData?: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // `additionalData: undefined` throws "Not a BufferSource"; the key must be omitted
  const algorithm: AesGcmParams = additionalData
    ? { name: 'AES-GCM', iv, additionalData: toArrayBuffer(additionalData) }
    : { name: 'AES-GCM', iv };
  const encrypted = await crypto.subtle.encrypt(algorithm, key, textEncoder.encode(plaintext));

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return bytesToBase64(combined);
}

/** Rejects on any authentication failure; never returns unverified plaintext. */
export async function openBytes(key: CryptoKey, sealedB64: string, additionalData?: Uint8Array): Promise<string> {
  const combined = base64ToBytes(sealedB64);
  if (combined.length <= IV_LENGTH) {
    throw new Error('Sealed payload is too short to contain a nonce');
  }

  const algorithm: AesGcmParams = additionalData
    ? { name: 'AES-GCM', iv: combined.slice(0, IV_LENGTH), additionalData: toArrayBuffer(additionalData) }
    : { name: 'AES-GCM', iv: combined.slice(0, IV_LENGTH) };
  const decrypted = await crypto.subtle.decrypt(algorithm, key, toArrayBuffer(combined.slice(IV_LENGTH)));

  return textDecoder.decode(decrypted);
}

let cryptoKey: CryptoKey | null = null;

export function isEncryptionAvailable(): boolean {
  return cryptoKey !== null;
}

/** When no backend key is configured. */
export async function initSessionEncryption(): Promise<void> {
  if (cryptoKey !== null) return; // Already initialized

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const base64Key = bytesToBase64(rawKey);
  await initEncryption(base64Key);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** 32-byte key, base64. */
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

export async function encryptMessage(data: unknown): Promise<string> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return sealBytes(cryptoKey, JSON.stringify(data));
}

export async function decryptMessage(encryptedBase64: string): Promise<unknown> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return JSON.parse(await openBytes(cryptoKey, encryptedBase64));
}

export async function encryptString(data: string): Promise<string> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return sealBytes(cryptoKey, data);
}

export async function decryptString(encryptedBase64: string): Promise<string> {
  if (!cryptoKey) {
    throw new Error('Encryption not initialized');
  }

  return openBytes(cryptoKey, encryptedBase64);
}

// --- Persistent encryption (key stored in localStorage) ---

const PERSISTENT_KEY_STORAGE = 'sic-ek';
let persistentKey: CryptoKey | null = null;

/** Key in localStorage['sic-ek']. */
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

