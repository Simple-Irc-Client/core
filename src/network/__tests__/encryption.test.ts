import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sealBytes, openBytes } from '../encryption';

const generateKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

describe('sealBytes / openBytes', () => {
  it('round-trips without additionalData (regression: WebCrypto rejects an explicit `additionalData: undefined`)', async () => {
    const key = await generateKey();
    const sealed = await sealBytes(key, 'hello world');
    await expect(openBytes(key, sealed)).resolves.toBe('hello world');
  });

  it('round-trips with additionalData', async () => {
    const key = await generateKey();
    const aad = new TextEncoder().encode('protocol-label');
    const sealed = await sealBytes(key, 'hello world', aad);
    await expect(openBytes(key, sealed, aad)).resolves.toBe('hello world');
  });

  it('rejects when additionalData does not match on open', async () => {
    const key = await generateKey();
    const sealed = await sealBytes(key, 'hello world', new TextEncoder().encode('label-a'));
    await expect(openBytes(key, sealed, new TextEncoder().encode('label-b'))).rejects.toThrow();
  });
});

describe('openBytes on damaged input', () => {
  it('rejects a payload too short to hold a nonce', async () => {
    const key = await generateKey();
    await expect(openBytes(key, btoa('short'))).rejects.toThrow('too short');
  });

  it('rejects a payload changed after sealing', async () => {
    const key = await generateKey();
    const sealed = await sealBytes(key, 'hello world');
    const bytes = Uint8Array.from(atob(sealed), (char) => char.charCodeAt(0));
    bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
    await expect(openBytes(key, btoa(String.fromCharCode(...bytes)))).rejects.toThrow();
  });

  it('rejects a payload sealed under another key', async () => {
    const sealed = await sealBytes(await generateKey(), 'hello world');
    await expect(openBytes(await generateKey(), sealed)).rejects.toThrow();
  });
});

describe('session encryption', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('refuses to work before it is set up', async () => {
    const { encryptString, decryptString, isEncryptionAvailable } = await import('../encryption');

    expect(isEncryptionAvailable()).toBe(false);
    await expect(encryptString('secret')).rejects.toThrow('not initialized');
    await expect(decryptString('AAAA')).rejects.toThrow('not initialized');
  });

  it('round-trips under a key of its own, set up once', async () => {
    const { decryptString, encryptString, initSessionEncryption, isEncryptionAvailable } = await import('../encryption');

    await initSessionEncryption();
    const sealed = await encryptString('secret');
    await initSessionEncryption();

    expect(isEncryptionAvailable()).toBe(true);
    await expect(decryptString(sealed)).resolves.toBe('secret');
  });

  it('round-trips under a key it is given, and never seals the same text twice the same', async () => {
    const { decryptString, encryptString, initEncryption } = await import('../encryption');

    await initEncryption(btoa(String.fromCharCode(...new Uint8Array(32).fill(7))));
    const first = await encryptString('secret');
    const second = await encryptString('secret');

    expect(first).not.toBe(second);
    await expect(decryptString(second)).resolves.toBe('secret');
  });
});

describe('persistent encryption', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a key on first use and keeps it in localStorage', async () => {
    const { encryptPersistent, decryptPersistent } = await import('../encryption');

    const sealed = await encryptPersistent('password');

    expect(localStorage.getItem('sic-ek')).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    await expect(decryptPersistent(sealed)).resolves.toBe('password');
  });

  it('opens after a reload what was sealed before it', async () => {
    const before = await import('../encryption');
    const sealed = await before.encryptPersistent('password');
    vi.resetModules();
    const after = await import('../encryption');

    await expect(after.decryptPersistent(sealed)).resolves.toBe('password');
  });

  it('cannot open what was sealed under a key since lost', async () => {
    const before = await import('../encryption');
    const sealed = await before.encryptPersistent('password');
    vi.resetModules();
    localStorage.clear();
    const after = await import('../encryption');

    await expect(after.decryptPersistent(sealed)).rejects.toThrow();
  });

  it.each([
    ['not base64', '%%% not a key %%%'],
    ['of the wrong length', btoa('too short')],
  ])('replaces a stored key %s, so saving works again', async (_case, damaged) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('sic-ek', damaged);
    const { encryptPersistent, decryptPersistent } = await import('../encryption');

    const sealed = await encryptPersistent('password');

    expect(localStorage.getItem('sic-ek')).not.toBe(damaged);
    await expect(decryptPersistent(sealed)).resolves.toBe('password');
  });

  it('settles on one key when several callers at once find the stored one damaged', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('sic-ek', btoa('too short'));
    const { encryptPersistent } = await import('../encryption');

    const sealed = await Promise.all([encryptPersistent('a'), encryptPersistent('b'), encryptPersistent('c')]);
    vi.resetModules();
    const { decryptPersistent } = await import('../encryption');

    await expect(Promise.all(sealed.map((one) => decryptPersistent(one)))).resolves.toEqual(['a', 'b', 'c']);
  });
});
