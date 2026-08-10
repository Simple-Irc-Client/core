/**
 * SIC-E2EE v1 — long-term identity key storage.
 *
 * The identity key pair lives in IndexedDB as a live `CryptoKey` object rather
 * than as exported bytes. `idb-keyval` uses structured clone, which handles
 * `CryptoKey` natively, so a non-extractable private key can be persisted and
 * read back without ever existing as a byte array in JavaScript. That is a
 * meaningful step up from the `localStorage['sic-ek']` approach used by
 * `initPersistentEncryption` in `network/encryption.ts`, where the raw key sits
 * in a string any injected script could read.
 *
 * Identities are scoped per network. A single global identity would give the
 * user one stable fingerprint everywhere, which is convenient — but it would
 * also let anyone who sees the fingerprint on two networks link those two nicks
 * to the same person. IRC users routinely keep separate identities per network
 * on purpose, and silently undoing that would be a privacy regression.
 */

import { get, set, del } from 'idb-keyval';

import { getServer } from '@/features/settings/store/settings';

import { generateIdentity, type Identity } from './crypto';

const IDENTITY_STORAGE_PREFIX = 'sic-e2ee-identity';

/** Cache per network key so repeated handshakes don't hit IndexedDB. */
const cache = new Map<string, Identity>();

/** In-flight loads, so concurrent handshakes can't race two identities into existence. */
const pending = new Map<string, Promise<Identity>>();

const getNetworkKey = (): string => {
  const network = getServer()?.network;

  return `${IDENTITY_STORAGE_PREFIX}:${network && network.length > 0 ? network : 'default'}`;
};

/**
 * A stored identity is only usable if the private key survived the round trip.
 * A browser that dropped structured-clone support for `CryptoKey`, or a partly
 * written record, would otherwise blow up much later inside `deriveBits`.
 */
const isUsableIdentity = (value: unknown): value is Identity => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<Identity>;

  return (
    typeof candidate.publicKeyB64 === 'string' &&
    typeof candidate.fingerprint === 'string' &&
    candidate.privateKey instanceof CryptoKey &&
    candidate.publicKey instanceof CryptoKey
  );
};

const loadOrCreate = async (storageKey: string): Promise<Identity> => {
  try {
    const stored: unknown = await get(storageKey);
    if (isUsableIdentity(stored)) {
      return stored;
    }
  } catch (error) {
    // Private browsing, blocked storage, corrupted record — fall through and
    // generate a fresh identity. Encryption still works for this session; the
    // only cost is that peers see a new fingerprint.
    console.warn('E2EE: could not read stored identity, generating a new one:', error);
  }

  const identity = await generateIdentity();

  try {
    await set(storageKey, identity);
  } catch (error) {
    console.warn('E2EE: could not persist identity, it will not survive a restart:', error);
  }

  return identity;
};

/**
 * Get this network's identity, creating and persisting one on first use.
 * Concurrent callers share a single generation.
 */
export const getIdentity = async (): Promise<Identity> => {
  const storageKey = getNetworkKey();

  const cached = cache.get(storageKey);
  if (cached) {
    return cached;
  }

  const inFlight = pending.get(storageKey);
  if (inFlight) {
    return inFlight;
  }

  const load = loadOrCreate(storageKey)
    .then((identity) => {
      cache.set(storageKey, identity);
      return identity;
    })
    .finally(() => {
      pending.delete(storageKey);
    });

  pending.set(storageKey, load);

  return load;
};

/**
 * Discard this network's identity and generate a fresh one on next use.
 *
 * Every peer who pinned the old key will see a fingerprint-changed warning, so
 * this is only reachable from an explicit user action.
 */
export const resetIdentity = async (): Promise<void> => {
  const storageKey = getNetworkKey();
  cache.delete(storageKey);
  pending.delete(storageKey);

  try {
    await del(storageKey);
  } catch (error) {
    console.warn('E2EE: could not delete stored identity:', error);
  }
};

/** Test seam — drops the in-memory cache without touching IndexedDB. */
export const clearIdentityCache = (): void => {
  cache.clear();
  pending.clear();
};
