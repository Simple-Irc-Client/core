/**
 * Tests for `crypto.ts` — the actual cryptographic properties the handshake
 * relies on, not mocked. If these hold, the guarantees `session.ts` promises
 * (a substituted key breaks the session instead of silently working, a
 * tampered or replayed message fails to decrypt, two conversations never
 * share a key) are real rather than assumed.
 */
import { describe, it, expect } from 'vitest';

import {
  deriveSessionKeys,
  fingerprintFromB64,
  generateEphemeral,
  generateIdentity,
  importPublicKey,
  open,
  seal,
  type Identity,
  type KeyPairWithPublic,
  type SessionKeys,
} from '../crypto';
import { NATO_HEX_WORDS } from '../natoWordList';

/** One participant in a handshake: a long-term identity plus a fresh per-conversation ephemeral, same shape `session.ts` builds for real. */
interface Party {
  identity: Identity;
  ephemeral: KeyPairWithPublic;
}

const createParty = async (): Promise<Party> => ({
  identity: await generateIdentity(),
  ephemeral: await generateEphemeral(),
});

/** Run the full handshake between two freshly generated parties, exactly as `session.ts`'s initiator and responder would. */
const handshake = async (alice: Party, bob: Party): Promise<{ alice: SessionKeys; bob: SessionKeys }> => ({
  alice: await deriveSessionKeys({
    role: 'initiator',
    identity: alice.identity,
    ephemeral: alice.ephemeral,
    theirIdentityKeyB64: bob.identity.publicKeyB64,
    theirEphemeralKeyB64: bob.ephemeral.publicKeyB64,
  }),
  bob: await deriveSessionKeys({
    role: 'responder',
    identity: bob.identity,
    ephemeral: bob.ephemeral,
    theirIdentityKeyB64: alice.identity.publicKeyB64,
    theirEphemeralKeyB64: alice.ephemeral.publicKeyB64,
  }),
});

describe('e2ee crypto', () => {
  describe('generateIdentity', () => {
    it('keeps the private key non-extractable while still exporting the public half', async () => {
      const identity = await generateIdentity();

      expect(identity.privateKey.extractable).toBe(false);
      expect(identity.publicKeyB64.length).toBeGreaterThan(0);
      await expect(crypto.subtle.exportKey('pkcs8', identity.privateKey)).rejects.toThrow();
    });

    it('produces a different identity every time', async () => {
      const [first, second] = await Promise.all([generateIdentity(), generateIdentity()]);

      expect(first.publicKeyB64).not.toBe(second.publicKeyB64);
      expect(first.fingerprint).not.toBe(second.fingerprint);
    });
  });

  describe('fingerprint', () => {
    it('formats as sixteen NATO phonetic alphabet words, one per hex nibble', async () => {
      const identity = await generateIdentity();
      const words = identity.fingerprint.split(' ');

      expect(words).toHaveLength(16);
      for (const word of words) {
        expect(NATO_HEX_WORDS).toContain(word);
      }
    });

    it('is stable across an export/import round trip', async () => {
      const identity = await generateIdentity();
      const imported = await importPublicKey(identity.publicKeyB64);
      const reExported = await crypto.subtle.exportKey('spki', imported);
      const reExportedB64 = btoa(String.fromCharCode(...new Uint8Array(reExported)));

      expect(await fingerprintFromB64(reExportedB64)).toBe(identity.fingerprint);
    });
  });

  describe('importPublicKey', () => {
    it('rejects data that is not a valid P-256 public key', async () => {
      await expect(importPublicKey(btoa('not a key at all'))).rejects.toThrow();
    });

    it('rejects invalid base64', async () => {
      await expect(importPublicKey('!!!not-base64!!!')).rejects.toThrow();
    });
  });

  describe('deriveSessionKeys', () => {
    it('gives both sides matching directional keys', async () => {
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      const fromAlice = await seal(keys.alice.sendKey, 'hello bob');
      expect(await open(keys.bob.recvKey, fromAlice)).toBe('hello bob');

      const fromBob = await seal(keys.bob.sendKey, 'hello alice');
      expect(await open(keys.alice.recvKey, fromBob)).toBe('hello alice');
    });

    it('uses separate keys per direction, so a reflected frame does not decrypt', async () => {
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      // An attacker bounces Alice's own ciphertext straight back at her. If both
      // directions shared a key this would surface as a genuine message "from Bob".
      const reflected = await seal(keys.alice.sendKey, 'transfer the money');
      await expect(open(keys.alice.recvKey, reflected)).rejects.toThrow();
    });

    it('derives a different session for every conversation', async () => {
      // Alice talks to both Bob and Mallory. A message meant for Bob must not
      // be readable by Mallory just because Alice used the same identity key
      // for both — each conversation has to end up with its own keys.
      const [alice, bob, mallory] = await Promise.all([createParty(), createParty(), createParty()]);
      const withBob = await handshake(alice, bob);
      const withMallory = await handshake(alice, mallory);

      const forBob = await seal(withBob.alice.sendKey, 'secret for bob');
      await expect(open(withMallory.bob.recvKey, forBob)).rejects.toThrow();
    });

    it('fails when an ephemeral key is substituted in transit', async () => {
      const [alice, bob, attacker] = await Promise.all([createParty(), createParty(), createParty()]);

      // Bob receives Alice's identity but the attacker's ephemeral key.
      const aliceKeys = await deriveSessionKeys({
        role: 'initiator',
        identity: alice.identity,
        ephemeral: alice.ephemeral,
        theirIdentityKeyB64: bob.identity.publicKeyB64,
        theirEphemeralKeyB64: bob.ephemeral.publicKeyB64,
      });
      const bobKeys = await deriveSessionKeys({
        role: 'responder',
        identity: bob.identity,
        ephemeral: bob.ephemeral,
        theirIdentityKeyB64: alice.identity.publicKeyB64,
        theirEphemeralKeyB64: attacker.ephemeral.publicKeyB64,
      });

      const message = await seal(aliceKeys.sendKey, 'hi');
      await expect(open(bobKeys.recvKey, message)).rejects.toThrow();
    });

    it('fails when the identity key is substituted, which is what makes pinning meaningful', async () => {
      const [alice, bob, attacker] = await Promise.all([createParty(), createParty(), createParty()]);

      // Alice pinned Bob's real identity, so she derives against it. The attacker
      // sits in the middle holding their own identity key.
      const aliceKeys = await deriveSessionKeys({
        role: 'initiator',
        identity: alice.identity,
        ephemeral: alice.ephemeral,
        theirIdentityKeyB64: bob.identity.publicKeyB64,
        theirEphemeralKeyB64: attacker.ephemeral.publicKeyB64,
      });
      const attackerKeys = await deriveSessionKeys({
        role: 'responder',
        identity: attacker.identity,
        ephemeral: attacker.ephemeral,
        theirIdentityKeyB64: alice.identity.publicKeyB64,
        theirEphemeralKeyB64: alice.ephemeral.publicKeyB64,
      });

      const message = await seal(aliceKeys.sendKey, 'hi');
      await expect(open(attackerKeys.recvKey, message)).rejects.toThrow();
    });

    it('rejects a peer key that is not a valid public key', async () => {
      // A peer's OFFER frame reaches this with attacker-controlled bytes as
      // the "public key" — must throw, not derive keys from garbage.
      const alice = await createParty();

      await expect(
        deriveSessionKeys({
          role: 'initiator',
          identity: alice.identity,
          ephemeral: alice.ephemeral,
          theirIdentityKeyB64: btoa('garbage'),
          theirEphemeralKeyB64: alice.ephemeral.publicKeyB64,
        }),
      ).rejects.toThrow();
    });
  });

  describe('seal/open', () => {
    it('round-trips unicode and empty bodies', async () => {
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      for (const body of ['', 'żółć 🔒 — ok', 'a'.repeat(4000)]) {
        expect(await open(keys.bob.recvKey, await seal(keys.alice.sendKey, body))).toBe(body);
      }
    });

    it('produces a different ciphertext each time for the same body', async () => {
      // Proves `seal` really does use a fresh random nonce per call (see
      // `IV_LENGTH` in crypto.ts) — a reused nonce is what breaks AES-GCM.
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      expect(await seal(keys.alice.sendKey, 'same')).not.toBe(await seal(keys.alice.sendKey, 'same'));
    });

    it('rejects a single flipped ciphertext byte', async () => {
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      const sealed = await seal(keys.alice.sendKey, 'do not tamper');
      const bytes = Uint8Array.from(atob(sealed), (char) => char.charCodeAt(0));
      bytes.set([(bytes.at(-1) ?? 0) ^ 0x01], bytes.length - 1);
      const tampered = btoa(String.fromCharCode(...bytes));

      await expect(open(keys.bob.recvKey, tampered)).rejects.toThrow();
    });

    it('rejects a truncated frame rather than returning partial plaintext', async () => {
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      const sealed = await seal(keys.alice.sendKey, 'a message long enough to slice');
      const bytes = Uint8Array.from(atob(sealed), (char) => char.charCodeAt(0)).slice(0, -4);

      await expect(open(keys.bob.recvKey, btoa(String.fromCharCode(...bytes)))).rejects.toThrow();
    });

    it('rejects a payload too short to hold a nonce', async () => {
      const [alice, bob] = await Promise.all([createParty(), createParty()]);
      const keys = await handshake(alice, bob);

      await expect(open(keys.bob.recvKey, btoa('short'))).rejects.toThrow(/too short/);
    });
  });
});
