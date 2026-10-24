import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { splitLine } from '../multiline';

const bytes = (text: string): number => new TextEncoder().encode(text).length;

describe('splitLine, for any line', () => {
  const line = fc.string({ unit: 'grapheme', minLength: 1, maxLength: 300 });
  const budget = fc.integer({ min: 4, max: 120 });

  it('joins back to the line', () => {
    fc.assert(fc.property(line, budget, (text, maxBytes) => {
      expect(splitLine(text, maxBytes).join('')).toBe(text);
    }));
  });

  it('keeps every piece within the budget, unless one character alone is larger', () => {
    fc.assert(fc.property(line, budget, (text, maxBytes) => {
      for (const piece of splitLine(text, maxBytes)) {
        expect(bytes(piece) <= maxBytes || [...piece].length === 1).toBe(true);
      }
    }));
  });

  it('never cuts a character in two', () => {
    fc.assert(fc.property(line, budget, (text, maxBytes) => {
      for (const piece of splitLine(text, maxBytes)) {
        expect(piece).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      }
    }));
  });
});
