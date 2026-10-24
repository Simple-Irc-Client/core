import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { hasIrcFormatting, IRC_FORMAT, parseIrcFormatting, stripIrcFormatting } from '../ircFormatting';
import { foldName, namesEqual, type CaseMapping } from '../caseMapping';
import { applySpoilerMarkup, plainText, SPOILER_MASK } from '@features/chat/spoilers';

const formatting = fc.constantFrom(...Object.values(IRC_FORMAT), `${IRC_FORMAT.COLOR}04`, `${IRC_FORMAT.COLOR}4,12`, `${IRC_FORMAT.COLOR}99,99`, `${IRC_FORMAT.HEX_COLOR}FF0000`, `${IRC_FORMAT.HEX_COLOR}00ff00,0000FF`);
/** Text mixing plain characters, digits and commas with formatting codes */
const formattedText = fc.array(fc.oneof(fc.string({ maxLength: 6 }), fc.constantFrom('1', '12', ',', ',5', 'aB3', ',ABCDEF'), formatting), { maxLength: 20 }).map((parts) => parts.join(''));
const mapping = fc.constantFrom<CaseMapping>('ascii', 'rfc1459', 'rfc1459-strict');

describe('IRC formatting, for any text', () => {
  it('the parsed runs hold the same text as the stripped line', () => {
    fc.assert(fc.property(formattedText, (text) => {
      expect(parseIrcFormatting(text).map((segment) => segment.text).join('')).toBe(stripIrcFormatting(text));
    }));
  });

  it('stripped text has no formatting codes left', () => {
    fc.assert(fc.property(formattedText, (text) => {
      expect(hasIrcFormatting(stripIrcFormatting(text))).toBe(false);
    }));
  });
});

describe('spoilers, for any text', () => {
  const hidden = fc.stringMatching(/^[a-z0-9 ]{1,20}$/).filter((text) => text.trim() !== '');
  const around = fc.stringMatching(/^[a-z ]{0,20}$/);

  it('a spoiler shows as the mask in plain text, its words never', () => {
    fc.assert(fc.property(around, hidden, around, (before, secret, after) => {
      expect(plainText(applySpoilerMarkup(`${before}||${secret}||${after}`, null))).toBe(`${before}${SPOILER_MASK}${after}`);
    }));
  });

  it('text without a spoiler comes through as written', () => {
    // eslint-disable-next-line no-control-regex
    fc.assert(fc.property(fc.stringMatching(/^[^|\x00-\x1f]{0,40}$/), (text) => {
      expect(plainText(applySpoilerMarkup(text, null))).toBe(text);
    }));
  });
});

describe('nick folding, for any name', () => {
  it('folds once and for all', () => {
    fc.assert(fc.property(fc.string(), mapping, (name, caseMapping) => {
      expect(foldName(foldName(name, caseMapping), caseMapping)).toBe(foldName(name, caseMapping));
    }));
  });

  it('compares names the same either way round, and a name equal to its own upper case', () => {
    fc.assert(fc.property(fc.string(), fc.string(), mapping, (a, b, caseMapping) => {
      expect(namesEqual(a, b, caseMapping)).toBe(namesEqual(b, a, caseMapping));
      expect(namesEqual(a, a.replace(/[a-z]/g, (char) => char.toUpperCase()), caseMapping)).toBe(true);
    }));
  });
});
