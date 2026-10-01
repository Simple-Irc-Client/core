/**
 * Stored in IndexedDB as a live CryptoKey (structured clone), so the non-extractable private key never exists
 * as bytes in JS. Per network, so one fingerprint can't link a user's nicks across networks.
 */

import { get, set, del } from 'idb-keyval';

import { getServer } from '@/features/settings/store/settings';

import { fingerprintFromB64, generateIdentity, type Identity } from './crypto';

const IDENTITY_STORAGE_PREFIX = 'sic-e2ee-identity';

const cache = new Map<string, Identity>();

/** So concurrent handshakes can't race two identities into existence. */
const pending = new Map<string, Promise<Identity>>();

const getNetworkKey = (): string => {
  const network = getServer()?.network;

  return `${IDENTITY_STORAGE_PREFIX}:${network && network.length > 0 ? network : 'default'}`;
};

/** Otherwise a dropped or partial key would only fail much later, inside deriveBits. */
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
      // Recomputed so an older display format never sticks
      return { ...stored, fingerprint: await fingerprintFromB64(stored.publicKeyB64) };
    }
  } catch (error) {
    // Still works; peers just see a new fingerprint
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

/** Every pinning peer will see a fingerprint-changed warning: explicit user action only. */
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
