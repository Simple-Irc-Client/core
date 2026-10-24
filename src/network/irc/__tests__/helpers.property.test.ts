import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { escapeTagValue, parseIrcRawMessage, unescapeTagValue } from '../helpers';

describe('IRC helpers, for any input', () => {
  it('a tag value comes back as it was, and its escaped form has no space, semicolon or line break', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary' }), (value) => {
      const escaped = escapeTagValue(value);
      expect(escaped).not.toMatch(/[ ;\r\n]/);
      expect(unescapeTagValue(escaped)).toBe(value);
    }));
  });

  it('parsing a line never throws', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary' }), (line) => {
      expect(() => parseIrcRawMessage(line)).not.toThrow();
    }));
  });

  it('a line built from a command and parameters parses back to them', () => {
    const word = fc.stringMatching(/^[^\s:@][^\s]{0,15}$/);
    fc.assert(fc.property(fc.stringMatching(/^[A-Z]{1,10}$/), fc.array(word, { maxLength: 5 }), fc.stringMatching(/^[^\r\n]{0,40}$/), (command, params, trailing) => {
      const parsed = parseIrcRawMessage(`:nick!user@host ${command} ${[...params, `:${trailing}`].join(' ')}`);
      expect(parsed.command).toBe(command);
      expect(parsed.line.slice(0, params.length)).toEqual(params);
    }));
  });
});
