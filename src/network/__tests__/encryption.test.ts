import { describe, expect, it } from 'vitest';
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
