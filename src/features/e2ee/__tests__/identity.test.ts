import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
let getShouldThrow = false;
let setShouldThrow = false;

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => {
    if (getShouldThrow) {
      throw new Error('IndexedDB unavailable');
    }
    return store.get(key);
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    if (setShouldThrow) {
      throw new Error('Quota exceeded');
    }
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const network = { current: 'libera' as string | undefined };

vi.mock('@/features/settings/store/settings', () => ({
  getServer: (): { network: string | undefined } => ({ network: network.current }),
}));

const { getIdentity, resetIdentity, clearIdentityCache } = await import('../identity');

describe('e2ee identity', () => {
  beforeEach(() => {
    store.clear();
    clearIdentityCache();
    getShouldThrow = false;
    setShouldThrow = false;
    network.current = 'libera';
  });

  it('generates and persists an identity on first use', async () => {
    const identity = await getIdentity();

    expect(identity.fingerprint).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){3}$/);
    expect(store.has('sic-e2ee-identity:libera')).toBe(true);
  });

  it('returns the same identity across calls and across a cold cache', async () => {
    const first = await getIdentity();
    expect((await getIdentity()).publicKeyB64).toBe(first.publicKeyB64);

    clearIdentityCache();
    expect((await getIdentity()).publicKeyB64).toBe(first.publicKeyB64);
  });

  it('does not race two identities into existence under concurrent handshakes', async () => {
    const [first, second, third] = await Promise.all([getIdentity(), getIdentity(), getIdentity()]);

    expect(second.publicKeyB64).toBe(first.publicKeyB64);
    expect(third.publicKeyB64).toBe(first.publicKeyB64);
    expect(store.size).toBe(1);
  });

  it('keeps identities separate per network, so a fingerprint cannot link two nicks', async () => {
    const onLibera = await getIdentity();

    network.current = 'oftc';
    const onOftc = await getIdentity();

    expect(onOftc.publicKeyB64).not.toBe(onLibera.publicKeyB64);
    expect(store.has('sic-e2ee-identity:oftc')).toBe(true);

    network.current = 'libera';
    expect((await getIdentity()).publicKeyB64).toBe(onLibera.publicKeyB64);
  });

  it('falls back to a default scope when no network is known', async () => {
    network.current = undefined;
    await getIdentity();

    expect(store.has('sic-e2ee-identity:default')).toBe(true);
  });

  it('still yields a usable identity when storage cannot be read', async () => {
    getShouldThrow = true;
    const identity = await getIdentity();

    expect(identity.privateKey).toBeInstanceOf(CryptoKey);
  });

  it('still yields a usable identity when storage cannot be written', async () => {
    setShouldThrow = true;
    const identity = await getIdentity();

    expect(identity.privateKey).toBeInstanceOf(CryptoKey);
    expect(store.size).toBe(0);
  });

  it('regenerates instead of crashing when the stored record is corrupt', async () => {
    store.set('sic-e2ee-identity:libera', { publicKeyB64: 'still a string', privateKey: 'not a CryptoKey' });

    const identity = await getIdentity();

    expect(identity.privateKey).toBeInstanceOf(CryptoKey);
    expect(identity.publicKeyB64).not.toBe('still a string');
  });

  it('resetIdentity produces a fresh key on next use', async () => {
    const original = await getIdentity();
    await resetIdentity();
    const replacement = await getIdentity();

    expect(replacement.publicKeyB64).not.toBe(original.publicKeyB64);
  });

  it('resetIdentity only affects the current network', async () => {
    const onLibera = await getIdentity();
    network.current = 'oftc';
    const onOftc = await getIdentity();

    await resetIdentity();

    network.current = 'libera';
    expect((await getIdentity()).publicKeyB64).toBe(onLibera.publicKeyB64);
    network.current = 'oftc';
    expect((await getIdentity()).publicKeyB64).not.toBe(onOftc.publicKeyB64);
  });
});
