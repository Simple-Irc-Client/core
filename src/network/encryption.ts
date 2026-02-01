let encryptionKey: CryptoKey | null = null;

/**
 * Check if encryption is available (key has been initialized)
 */
export function isEncryptionAvailable(): boolean {
  return encryptionKey !== null;
}

/**
 * Convert base64 to Uint8Array (browser-compatible)
 */
function base64ToBytes(base64: string): Uint8Array {
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
function bytesToBase64(bytes: Uint8Array): string {
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
  encryptionKey = await crypto.subtle.importKey(
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
  if (!encryptionKey) {
    throw new Error('Encryption not initialized');
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const messageBytes = new TextEncoder().encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    messageBytes
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt a base64 string back to message object
 */
export async function decryptMessage(encryptedBase64: string): Promise<unknown> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized');
  }

  const combined = base64ToBytes(encryptedBase64);

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encryptedData
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Encrypt a raw string to base64 (no JSON wrapping)
 */
export async function encryptString(data: string): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized');
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const messageBytes = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    messageBytes
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt a base64 string back to raw string (no JSON parsing)
 */
export async function decryptString(encryptedBase64: string): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized');
  }

  const combined = base64ToBytes(encryptedBase64);

  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encryptedData
  );

  return new TextDecoder().decode(decrypted);
}

