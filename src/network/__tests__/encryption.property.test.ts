import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { openBytes, sealBytes } from '../encryption';

describe('sealing, for any text', () => {
  it('opens to the text sealed, under the same key and label', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await fc.assert(fc.asyncProperty(fc.string({ unit: 'binary' }), fc.option(fc.uint8Array({ maxLength: 32 }), { nil: undefined }), async (text, label) => {
      await expect(openBytes(key, await sealBytes(key, text, label), label)).resolves.toBe(text);
    }), { numRuns: 50 });
  });
});
