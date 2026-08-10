/**
 * A minimal SIC-E2EE v1 peer for end-to-end tests.
 *
 * This deliberately re-implements the protocol from its specification instead
 * of importing `src/features/e2ee/crypto.ts`. Sharing the implementation would
 * make the test self-consistent rather than correct: a mistake in the key
 * derivation would cancel out on both sides and the test would still pass. An
 * independent implementation means these tests actually prove interoperability.
 *
 * Mirrors, from the spec:
 *   - ECDH P-256 identity + ephemeral keys
 *   - ikm  = DH(ephI,ephR) ‖ DH(idI,ephR) ‖ DH(ephI,idR)
 *   - salt = SHA-256(spki(idI) ‖ spki(idR) ‖ spki(ephI) ‖ spki(ephR))
 *   - keys = HKDF-SHA256(ikm, salt, "sic-e2ee-v1 i2r" | "sic-e2ee-v1 r2i")
 *   - frame = base64(IV(12) ‖ AES-256-GCM(body, aad="sic-e2ee-v1"))
 *   - body  = "m"|"a" + text
 */

import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;

const PROTOCOL_LABEL = 'sic-e2ee-v1';
const MAX_CHUNK_CHARS = 320;
export const CTCP = '\x01';

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const fromBase64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

interface Pair {
  privateKey: webcrypto.CryptoKey;
  publicKeyB64: string;
}

const generatePair = async (): Promise<Pair> => {
  const pair = await subtle.generateKey(ECDH_PARAMS, true, ['deriveBits']);
  const spki = await subtle.exportKey('spki', pair.publicKey);
  return { privateKey: pair.privateKey, publicKeyB64: toBase64(new Uint8Array(spki)) };
};

const importPublic = async (b64: string): Promise<webcrypto.CryptoKey> =>
  subtle.importKey('spki', fromBase64(b64), ECDH_PARAMS, true, []);

const dh = async (priv: webcrypto.CryptoKey, pubB64: string): Promise<Uint8Array> =>
  new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: await importPublic(pubB64) }, priv, 256));

const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: string): Promise<webcrypto.CryptoKey> => {
  const base = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) },
    base,
    256,
  );
  return subtle.importKey('raw', bits, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

export interface PeerSession {
  sendKey: webcrypto.CryptoKey;
  recvKey: webcrypto.CryptoKey;
}

export type Role = 'initiator' | 'responder';

/** A SIC-E2EE peer: holds an identity, runs one handshake, seals and opens messages. */
export class E2eePeer {
  private identity!: Pair;
  private ephemeral!: Pair;
  private session: PeerSession | null = null;

  async init(): Promise<void> {
    this.identity = await generatePair();
    this.ephemeral = await generatePair();
  }

  /**
   * Roll a fresh ephemeral key for a new handshake, keeping the long-term
   * identity. A real peer does exactly this: the identity is what the other
   * side pins, so regenerating it would look like a key substitution.
   */
  async newHandshake(): Promise<void> {
    this.ephemeral = await generatePair();
    this.session = null;
  }

  get identityKeyB64(): string {
    return this.identity.publicKeyB64;
  }

  get isActive(): boolean {
    return this.session !== null;
  }

  /** The CTCP body for an OFFER (send as PRIVMSG). */
  offerFrame(): string {
    return `SIC-E2EE OFFER 1 ${this.identity.publicKeyB64} ${this.ephemeral.publicKeyB64}`;
  }

  /** The CTCP body for an ACCEPT (send as NOTICE). */
  acceptFrame(): string {
    return `SIC-E2EE ACCEPT 1 ${this.identity.publicKeyB64} ${this.ephemeral.publicKeyB64}`;
  }

  /** SHA-256 fingerprint of a public key, formatted as the app displays it. */
  static async fingerprint(publicKeyB64: string): Promise<string> {
    const digest = await subtle.digest('SHA-256', fromBase64(publicKeyB64));
    const hex = [...new Uint8Array(digest).slice(0, 8)]
      .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    return (hex.match(/.{4}/g) ?? []).join(' ');
  }

  /** Derive the session from the peer's keys. */
  async completeHandshake(role: Role, theirIdentityB64: string, theirEphemeralB64: string): Promise<void> {
    const isInitiator = role === 'initiator';

    const dh1 = await dh(this.ephemeral.privateKey, theirEphemeralB64);
    const dh2 = isInitiator
      ? await dh(this.identity.privateKey, theirEphemeralB64)
      : await dh(this.ephemeral.privateKey, theirIdentityB64);
    const dh3 = isInitiator
      ? await dh(this.ephemeral.privateKey, theirIdentityB64)
      : await dh(this.identity.privateKey, theirEphemeralB64);

    const idI = isInitiator ? this.identity.publicKeyB64 : theirIdentityB64;
    const idR = isInitiator ? theirIdentityB64 : this.identity.publicKeyB64;
    const ephI = isInitiator ? this.ephemeral.publicKeyB64 : theirEphemeralB64;
    const ephR = isInitiator ? theirEphemeralB64 : this.ephemeral.publicKeyB64;

    const transcript = concat(fromBase64(idI), fromBase64(idR), fromBase64(ephI), fromBase64(ephR));
    const salt = new Uint8Array(await subtle.digest('SHA-256', transcript));
    const ikm = concat(dh1, dh2, dh3);

    const i2r = await hkdf(ikm, salt, `${PROTOCOL_LABEL} i2r`);
    const r2i = await hkdf(ikm, salt, `${PROTOCOL_LABEL} r2i`);

    this.session = isInitiator ? { sendKey: i2r, recvKey: r2i } : { sendKey: r2i, recvKey: i2r };
  }

  /** Encrypt a message into one or more `SICE` CTCP bodies. */
  async sealFrames(text: string, kind: 'm' | 'a' = 'm'): Promise<string[]> {
    if (!this.session) {
      throw new Error('No session');
    }

    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(PROTOCOL_LABEL) },
      this.session.sendKey,
      new TextEncoder().encode(kind + text),
    );
    const payload = toBase64(concat(iv, new Uint8Array(ciphertext)));

    const chunks: string[] = [];
    for (let offset = 0; offset < payload.length; offset += MAX_CHUNK_CHARS) {
      chunks.push(payload.slice(offset, offset + MAX_CHUNK_CHARS));
    }

    const frameId = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    return chunks.map((chunk, index) => `SICE ${frameId} ${index + 1}/${chunks.length} ${chunk}`);
  }

  /** Decrypt a fully reassembled payload; returns the kind marker and the text. */
  async open(payloadB64: string): Promise<{ kind: string; text: string }> {
    if (!this.session) {
      throw new Error('No session');
    }

    const combined = fromBase64(payloadB64);
    const plaintext = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: combined.slice(0, 12),
        additionalData: new TextEncoder().encode(PROTOCOL_LABEL),
      },
      this.session.recvKey,
      combined.slice(12),
    );

    const decoded = new TextDecoder().decode(plaintext);
    return { kind: decoded.slice(0, 1), text: decoded.slice(1) };
  }
}

/** Extract the CTCP body from a raw IRC line, or null if it carries none. */
export const ctcpBody = (line: string): string | null => {
  const colon = line.indexOf(' :');
  if (colon === -1) {
    return null;
  }
  const trailing = line.slice(colon + 2);
  return trailing.startsWith(CTCP) && trailing.endsWith(CTCP) && trailing.length > 1
    ? trailing.slice(1, -1)
    : null;
};

/** Reassemble `SICE` frames; returns the full payload once the last chunk lands. */
export class FrameCollector {
  private readonly parts = new Map<string, Map<number, string>>();

  accept(body: string): string | null {
    const match = /^SICE (\S+) (\d+)\/(\d+) (\S+)$/.exec(body);
    if (!match) {
      return null;
    }

    const [, frameId, indexRaw, totalRaw, chunk] = match;
    const index = Number(indexRaw);
    const total = Number(totalRaw);
    const key = frameId ?? '';

    let entry = this.parts.get(key);
    if (!entry) {
      entry = new Map();
      this.parts.set(key, entry);
    }
    entry.set(index, chunk ?? '');

    if (entry.size < total) {
      return null;
    }

    this.parts.delete(key);
    return Array.from({ length: total }, (_, position) => entry.get(position + 1) ?? '').join('');
  }
}
