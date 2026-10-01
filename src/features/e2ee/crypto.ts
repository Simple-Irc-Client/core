/**
 * SIC-E2EE v1 — cryptographic primitives, WebCrypto only.
 * P-256, not X25519: X25519 isn't dependable in the webviews Tauri embeds (WebKitGTK, WebView2).
 * X3DH-like without prekeys: identity + ephemeral keys, three DHs (see deriveSessionKeys).
 */

import { base64ToBytes, bytesToBase64, openBytes, sealBytes } from '@/network/encryption';

import { NATO_HEX_WORDS } from './natoWordList';

/** Protocol label — mixed into every derivation and used as AES-GCM additional data. */
const PROTOCOL_LABEL = 'sic-e2ee-v1';

const FINGERPRINT_BYTES = 8;

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

export type HandshakeRole = 'initiator' | 'responder';

export interface KeyPairWithPublic {
  /** Non-extractable for identity keys, so the secret never exists as bytes in JS. */
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  /** base64 SPKI, as sent on the wire */
  publicKeyB64: string;
}

export interface Identity extends KeyPairWithPublic {
  /** e.g. `Zero One Two ... Echo Foxtrot` */
  fingerprint: string;
}

export interface SessionKeys {
  sendKey: CryptoKey;
  /** Distinct from `sendKey`, see deriveSessionKeys */
  recvKey: CryptoKey;
}

const textEncoder = new TextEncoder();

// Uint8Array views can be offset into a larger buffer; WebCrypto wants plain ArrayBuffers
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
};

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
};

/** `extractable` applies only to the private key; public keys are always exportable. */
const generateKeyPair = async (extractable: boolean): Promise<KeyPairWithPublic> => {
  const pair = await crypto.subtle.generateKey(ECDH_PARAMS, extractable, ['deriveBits']);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);

  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyB64: bytesToBase64(new Uint8Array(spki)),
  };
};

/** Non-extractable, so even a script-injection bug can't read the private key. */
export const generateIdentity = async (): Promise<Identity> => {
  const pair = await generateKeyPair(false);

  return { ...pair, fingerprint: await fingerprintFromB64(pair.publicKeyB64) };
};

export const generateEphemeral = async (): Promise<KeyPairWithPublic> => generateKeyPair(true);

/** Throws on anything but a well-formed P-256 key, so garbage fails the handshake loudly. */
export const importPublicKey = async (publicKeyB64: string): Promise<CryptoKey> => {
  const spki = base64ToBytes(publicKeyB64);

  return crypto.subtle.importKey('spki', toArrayBuffer(spki), ECDH_PARAMS, true, []);
};

/** One NATO word per hex nibble: as precise as hex, unambiguous aloud. */
const encodeSas = (bytes: Uint8Array): string =>
  [...bytes].flatMap((byte) => [NATO_HEX_WORDS[byte >> 4], NATO_HEX_WORDS[byte & 0x0f]]).join(' ');

/** First 64 bits of SHA-256: short enough to read aloud; it only has to make a substituted key noticeable. */
export const fingerprintFromB64 = async (publicKeyB64: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(base64ToBytes(publicKeyB64)));
  const bytes = new Uint8Array(digest).slice(0, FINGERPRINT_BYTES);

  return encodeSas(bytes);
};

/** Raw ECDH output; not uniformly random, so it goes through hkdf. */
const deriveSharedBits = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> => {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);

  return new Uint8Array(bits);
};

const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: string): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBuffer(salt), info: toArrayBuffer(textEncoder.encode(info)) },
    baseKey,
    256,
  );

  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

export interface DeriveSessionKeysInput {
  role: HandshakeRole;
  identity: Identity;
  ephemeral: KeyPairWithPublic;
  theirIdentityKeyB64: string;
  theirEphemeralKeyB64: string;
}

/**
 * Directional AES-256-GCM keys from three DHs (each side swaps mine/theirs):
 *
 *   dh1   ephInitiator × ephResponder    forward secrecy
 *   dh2   idInitiator  × ephResponder    authenticates the initiator
 *   dh3   ephInitiator × idResponder     authenticates the responder
 *
 * dh2/dh3 bind the pinned identities, so substituting ephemerals alone can't match a pin. HKDF inputs:
 *
 *   ikm    dh1 ‖ dh2 ‖ dh3               the combined secret to stretch
 *   salt   hash of all 4 public keys     any handshake tampering changes the key
 *   info   "i2r" / "r2i" labels          gives send/receive independent keys
 *
 * Nicks stay out of the salt: casemapping differs per server, so clients could fold them differently.
 * Separate directional keys make a reflected frame fail to decrypt.
 */
export const deriveSessionKeys = async (input: DeriveSessionKeysInput): Promise<SessionKeys> => {
  const { role, identity, ephemeral, theirIdentityKeyB64, theirEphemeralKeyB64 } = input;

  const [theirIdentityKey, theirEphemeralKey] = await Promise.all([
    importPublicKey(theirIdentityKeyB64),
    importPublicKey(theirEphemeralKeyB64),
  ]);

  const isInitiator = role === 'initiator';

  const [dh1, dh2, dh3] = await Promise.all([
    deriveSharedBits(ephemeral.privateKey, theirEphemeralKey),
    // dh2 = ECDH(initiator identity, responder ephemeral)
    isInitiator
      ? deriveSharedBits(identity.privateKey, theirEphemeralKey)
      : deriveSharedBits(ephemeral.privateKey, theirIdentityKey),
    // dh3 = ECDH(initiator ephemeral, responder identity)
    isInitiator
      ? deriveSharedBits(ephemeral.privateKey, theirIdentityKey)
      : deriveSharedBits(identity.privateKey, theirEphemeralKey),
  ]);

  const ikm = concatBytes(dh1, dh2, dh3);

  // Transcript ordered by role so both sides hash the same byte sequence.
  const initiatorIdentity = isInitiator ? identity.publicKeyB64 : theirIdentityKeyB64;
  const responderIdentity = isInitiator ? theirIdentityKeyB64 : identity.publicKeyB64;
  const initiatorEphemeral = isInitiator ? ephemeral.publicKeyB64 : theirEphemeralKeyB64;
  const responderEphemeral = isInitiator ? theirEphemeralKeyB64 : ephemeral.publicKeyB64;

  const transcript = concatBytes(
    base64ToBytes(initiatorIdentity),
    base64ToBytes(responderIdentity),
    base64ToBytes(initiatorEphemeral),
    base64ToBytes(responderEphemeral),
  );
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', toArrayBuffer(transcript)));

  const [initiatorToResponder, responderToInitiator] = await Promise.all([
    hkdf(ikm, salt, `${PROTOCOL_LABEL} i2r`),
    hkdf(ikm, salt, `${PROTOCOL_LABEL} r2i`),
  ]);

  return isInitiator
    ? { sendKey: initiatorToResponder, recvKey: responderToInitiator }
    : { sendKey: responderToInitiator, recvKey: initiatorToResponder };
};

/** The protocol label as AAD blocks replay of ciphertext from another protocol version. */
export const seal = async (key: CryptoKey, plaintext: string): Promise<string> =>
  sealBytes(key, plaintext, textEncoder.encode(PROTOCOL_LABEL));

export const open = async (key: CryptoKey, sealedB64: string): Promise<string> =>
  openBytes(key, sealedB64, textEncoder.encode(PROTOCOL_LABEL));
