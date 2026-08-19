/**
 * SIC-E2EE v1 — cryptographic primitives.
 *
 * End-to-end encryption for private messages. Everything here is WebCrypto; no
 * third-party crypto dependency is pulled in.
 *
 * Curve choice: ECDH **P-256**, not X25519. X25519 in WebCrypto is still not
 * dependable across the webviews Tauri embeds (WebKitGTK on Linux, WebView2 on
 * Windows), and a key exchange that throws on a subset of our own desktop
 * builds is worse than a slightly less fashionable curve.
 *
 * Handshake shape is X3DH-like without prekeys: each side has a long-term
 * *identity* key and a per-conversation *ephemeral* key, and three DH
 * operations are mixed together so the session is bound to both identities
 * (authentication) while still rotating with the ephemerals (forward secrecy).
 * The three-DH mixing itself lives in `deriveSessionKeys` below.
 */

import { base64ToBytes, bytesToBase64 } from '@/network/encryption';

/** Protocol label — mixed into every derivation and used as AES-GCM additional data. */
const PROTOCOL_LABEL = 'sic-e2ee-v1';

/**
 * AES-GCM nonce length in bytes. 96 bits is the size the GCM spec optimises for.
 *
 * A "nonce" (here also called an IV, initialization vector) is a value that
 * must never repeat under the same key — GCM needs a fresh one per message so
 * that encrypting the same text twice doesn't produce the same ciphertext
 * twice. `seal` below generates one at random for every call.
 */
const IV_LENGTH = 12;

/** How many bytes of the public-key hash the user-visible fingerprint shows. */
const FINGERPRINT_BYTES = 8;

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

/** Which side of the handshake we are: the one who sent OFFER, or the one who answered. */
export type HandshakeRole = 'initiator' | 'responder';

export interface KeyPairWithPublic {
  /** Non-extractable for identity keys, so the secret never exists as bytes in JS. */
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  /**
   * `publicKey`, encoded as SPKI (SubjectPublicKeyInfo — the standard binary
   * layout for "here is a public key" that `crypto.subtle.exportKey` speaks)
   * and then base64'd so it's safe to drop into an IRC message. This string is
   * what actually goes out on the wire.
   */
  publicKeyB64: string;
}

export interface Identity extends KeyPairWithPublic {
  /** Short, human-comparable digest of the public key, e.g. `4F2A 91BC E07D 22A1`. */
  fingerprint: string;
}

export interface SessionKeys {
  /** Encrypts what we send. */
  sendKey: CryptoKey;
  /** Decrypts what we receive. Distinct from `sendKey` — see `deriveSessionKeys`. */
  recvKey: CryptoKey;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** WebCrypto wants plain ArrayBuffers; Uint8Array views can be offset into a larger buffer. */
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

// ---------------------------------------------------------------------------
// Key generation and import
// ---------------------------------------------------------------------------

/**
 * Generate an ECDH key pair and export its public half.
 *
 * ECDH (Elliptic Curve Diffie-Hellman) key pairs are what let two people agree
 * on a shared secret in `deriveSharedBits` below: a private key that never
 * leaves its owner, and a public key that's safe to hand to anyone.
 *
 * `extractable` applies only to the private key — per the WebCrypto spec public
 * keys of a generated pair are always extractable, which is what lets us export
 * SPKI below even for a non-extractable identity.
 */
const generateKeyPair = async (extractable: boolean): Promise<KeyPairWithPublic> => {
  const pair = await crypto.subtle.generateKey(ECDH_PARAMS, extractable, ['deriveBits']);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);

  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyB64: bytesToBase64(new Uint8Array(spki)),
  };
};

/**
 * Generate a long-term identity key pair. The private key is non-extractable,
 * so even a script-injection bug cannot read it out of the browser.
 */
export const generateIdentity = async (): Promise<Identity> => {
  const pair = await generateKeyPair(false);

  return { ...pair, fingerprint: await fingerprintFromB64(pair.publicKeyB64) };
};

/** Generate a throwaway key pair for a single conversation, giving forward secrecy. */
export const generateEphemeral = async (): Promise<KeyPairWithPublic> => generateKeyPair(true);

/**
 * Import a peer's public key from the base64 SPKI they sent us — the reverse
 * of the `publicKeyB64` encoding described on `KeyPairWithPublic` above.
 *
 * Throws on anything that is not a well-formed P-256 public key, which is the
 * point: a peer sending garbage must fail the handshake loudly rather than
 * silently degrade to something unencrypted.
 */
export const importPublicKey = async (publicKeyB64: string): Promise<CryptoKey> => {
  const spki = base64ToBytes(publicKeyB64);

  return crypto.subtle.importKey('spki', toArrayBuffer(spki), ECDH_PARAMS, true, []);
};

/**
 * User-visible fingerprint of a public key: the first 8 bytes of its SHA-256,
 * hex, in space-separated groups of four characters.
 *
 * Truncating to 64 bits is deliberate — it has to be short enough that two
 * people will actually read it to each other. Second-preimage resistance is not
 * what protects the session here (the triple DH in `deriveSessionKeys` is); the
 * fingerprint only has to make a substituted key *noticeable*.
 */
export const fingerprintFromB64 = async (publicKeyB64: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(base64ToBytes(publicKeyB64)));
  const bytes = new Uint8Array(digest).slice(0, FINGERPRINT_BYTES);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('');

  return (hex.match(/.{4}/g) ?? []).join(' ');
};

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Run one ECDH: combine our private key with their public key into a shared
 * secret only the two of us could compute — the core trick of Diffie-Hellman
 * key exchange. This raw secret is *not* itself a usable encryption key (it
 * isn't uniformly random); `hkdf` below turns it into one.
 */
const deriveSharedBits = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> => {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);

  return new Uint8Array(bits);
};

/**
 * Stretch a raw shared secret into one proper AES-256-GCM key, via HKDF
 * (HMAC-based Key Derivation Function — WebCrypto's standard tool for turning
 * a raw Diffie-Hellman secret into one or more independent, uniformly random
 * keys). Its three inputs, in HKDF's own terminology:
 *
 * - `ikm` ("input keying material"): the raw secret to stretch — here, the
 *   concatenation of three ECDH outputs computed in `deriveSessionKeys`.
 * - `salt`: a value that does *not* need to be secret, but changes the output
 *   even for the same `ikm`. We pass a hash of the whole handshake transcript
 *   (see `deriveSessionKeys`), so a tampered handshake derives different keys.
 * - `info`: a short label used to get several *different* keys out of the
 *   *same* `ikm`/`salt` pair in one handshake — `deriveSessionKeys` calls this
 *   twice with different labels to get independent send/receive keys.
 */
const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: string): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBuffer(salt), info: toArrayBuffer(textEncoder.encode(info)) },
    baseKey,
    256,
  );

  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

/**
 * Everything `deriveSessionKeys` needs: our two key pairs plus the two public
 * keys the peer sent us. Ours are full key pairs (we generated them, so we
 * hold the private half too); theirs are only ever the base64 public key they
 * put on the wire — see `publicKeyB64` on `KeyPairWithPublic`.
 */
export interface DeriveSessionKeysInput {
  /** Whether we sent the OFFER (initiator) or answered one (responder) — decides who owns which half of each DH below. */
  role: HandshakeRole;
  /** Our long-term key pair. */
  identity: Identity;
  /** Our throwaway key pair for this conversation. */
  ephemeral: KeyPairWithPublic;
  /** The peer's long-term public key, as they sent it. */
  theirIdentityKeyB64: string;
  /** The peer's throwaway public key for this conversation, as they sent it. */
  theirEphemeralKeyB64: string;
}

/**
 * Derive the pair of directional AES-256-GCM keys for a conversation.
 *
 * Three Diffie-Hellmans (see `deriveSharedBits`) are concatenated into the
 * HKDF input:
 *
 *   dh1 = ECDH(ephInitiator, ephResponder)   forward secrecy
 *   dh2 = ECDH(idInitiator,  ephResponder)   authenticates the initiator
 *   dh3 = ECDH(ephInitiator, idResponder)    authenticates the responder
 *
 * Each side computes the same three values with the roles of "mine" and
 * "theirs" swapped. Because dh2 and dh3 involve the long-term identity keys, an
 * attacker who substitutes only the ephemerals cannot produce a session that
 * works against a *pinned* identity — which is what makes the trust-on-first-
 * use pin in `store/pins.ts` meaningful rather than decorative.
 *
 * The salt is a transcript hash over all four public keys, so any tampering
 * with the handshake produces a different key and the first message simply
 * fails to authenticate. Note that nicknames are deliberately *not* mixed in:
 * IRC casemapping varies per server (rfc1459 folds `[]\` to `{}|`, ascii does
 * not), and two clients disagreeing on how to fold a nick would silently derive
 * different keys. The transcript hash binds the handshake without that hazard.
 *
 * Send and receive use separate keys derived with different `info` labels. That
 * removes any chance of an IV collision between the two directions, and makes a
 * reflected frame — our own ciphertext bounced back at us — fail to decrypt
 * instead of appearing to be a genuine message from the peer.
 */
export const deriveSessionKeys = async (input: DeriveSessionKeysInput): Promise<SessionKeys> => {
  const { role, identity, ephemeral, theirIdentityKeyB64, theirEphemeralKeyB64 } = input;

  const theirIdentityKey = await importPublicKey(theirIdentityKeyB64);
  const theirEphemeralKey = await importPublicKey(theirEphemeralKeyB64);

  const isInitiator = role === 'initiator';

  const dh1 = await deriveSharedBits(ephemeral.privateKey, theirEphemeralKey);
  // dh2 is always ECDH(identity of initiator, ephemeral of responder): as the
  // initiator that is our identity against their ephemeral, and vice versa.
  const dh2 = isInitiator
    ? await deriveSharedBits(identity.privateKey, theirEphemeralKey)
    : await deriveSharedBits(ephemeral.privateKey, theirIdentityKey);
  // dh3 is the mirror: ECDH(ephemeral of initiator, identity of responder).
  const dh3 = isInitiator
    ? await deriveSharedBits(ephemeral.privateKey, theirIdentityKey)
    : await deriveSharedBits(identity.privateKey, theirEphemeralKey);

  // The combined "input keying material" HKDF will stretch into real keys —
  // see the `hkdf` helper above.
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

  const initiatorToResponder = await hkdf(ikm, salt, `${PROTOCOL_LABEL} i2r`);
  const responderToInitiator = await hkdf(ikm, salt, `${PROTOCOL_LABEL} r2i`);

  return isInitiator
    ? { sendKey: initiatorToResponder, recvKey: responderToInitiator }
    : { sendKey: responderToInitiator, recvKey: initiatorToResponder };
};

// ---------------------------------------------------------------------------
// Message encryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a message body with AES-GCM, which — unlike plain AES — also
 * produces an authentication tag proving the ciphertext wasn't modified in
 * transit; `open` below rejects anything where that check fails. Output is
 * base64 of `IV ‖ ciphertext ‖ tag`, matching the layout already used by
 * `network/encryption.ts`.
 *
 * `additionalData` is our protocol label: authenticated the same way as the
 * rest of the message, but not itself encrypted, so a ciphertext produced for
 * a different protocol version can't be replayed here even though the label
 * is visible.
 */
export const seal = async (key: CryptoKey, plaintext: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: textEncoder.encode(PROTOCOL_LABEL) },
    key,
    textEncoder.encode(plaintext),
  );

  return bytesToBase64(concatBytes(iv, new Uint8Array(encrypted)));
};

/**
 * Decrypt a sealed body. Rejects on a wrong key, a tampered byte, a truncated
 * frame, or a frame produced by a different protocol version — GCM
 * authentication makes all of those indistinguishable failures, which is the
 * behaviour we want.
 */
export const open = async (key: CryptoKey, sealedB64: string): Promise<string> => {
  const combined = base64ToBytes(sealedB64);
  if (combined.length <= IV_LENGTH) {
    throw new Error('Sealed payload is too short to contain a nonce');
  }

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: combined.slice(0, IV_LENGTH),
      additionalData: textEncoder.encode(PROTOCOL_LABEL),
    },
    key,
    toArrayBuffer(combined.slice(IV_LENGTH)),
  );

  return textDecoder.decode(decrypted);
};
