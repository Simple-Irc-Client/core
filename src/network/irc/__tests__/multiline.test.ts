import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type BatchState } from '../batch';
import { addAvailableCapabilities, markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';
import { buildPrivmsgs, combineMultiline, getMultilineLimits, privmsgTextBudget, splitLine } from '../multiline';
import * as networksStore from '@features/networks/store/networks';
import { type ParsedIrcRawMessage } from '@shared/types';

const enableMultiline = (value: string): void => {
  addAvailableCapabilities({ batch: '', 'draft/multiline': value });
  markCapabilitiesAcknowledged(['batch', 'draft/multiline']);
};

/** The batch reference the client made up, from its opening line */
const referenceOf = (line: string): string => /BATCH \+(\S+)/.exec(line)?.[1] ?? '';

const privmsg = (text: string, tags: Record<string, string> = {}, { sender = 'friend!u@h', command = 'PRIVMSG', target = '#chan' } = {}): ParsedIrcRawMessage => ({
  tags: { batch: 'ml', ...tags },
  sender,
  command,
  line: [target, ...`:${text}`.split(' ')],
});

const batch = (messages: ParsedIrcRawMessage[], tags: Record<string, string> = {}, params = ['#chan']): BatchState => ({
  id: 'ml',
  type: 'draft/multiline',
  params,
  messages,
  startTime: 0,
  tags,
});

describe('multiline', () => {
  beforeEach(() => {
    resetCapabilityState();
    vi.spyOn(networksStore, 'getLineLenLimit').mockReturnValue(0);
  });

  describe('getMultilineLimits', () => {
    it('should read max-bytes and max-lines', () => {
      enableMultiline('max-bytes=4096,max-lines=100');
      expect(getMultilineLimits()).toEqual({ maxBytes: 4096, maxLines: 100 });
    });

    it('should not limit the lines when max-lines is not given', () => {
      enableMultiline('max-bytes=4096');
      expect(getMultilineLimits()).toEqual({ maxBytes: 4096, maxLines: Number.POSITIVE_INFINITY });
    });

    it('should ignore keys it does not know', () => {
      enableMultiline('future-key,max-lines=5,max-bytes=200');
      expect(getMultilineLimits()).toEqual({ maxBytes: 200, maxLines: 5 });
    });

    it.each(['', 'max-lines=10', 'max-bytes=0', 'max-bytes=-5', 'max-bytes=lots', 'max-bytes=1.5'])('should not send batches when the value is %j', (value) => {
      enableMultiline(value);
      expect(getMultilineLimits()).toBeUndefined();
    });

    it('should ignore an invalid max-lines', () => {
      enableMultiline('max-bytes=4096,max-lines=0');
      expect(getMultilineLimits()).toEqual({ maxBytes: 4096, maxLines: Number.POSITIVE_INFINITY });
    });

    it('should not send batches without the capability', () => {
      addAvailableCapabilities({ batch: '', 'draft/multiline': 'max-bytes=4096' });
      markCapabilitiesAcknowledged(['batch']);
      expect(getMultilineLimits()).toBeUndefined();
    });

    it('should not send batches without batch', () => {
      addAvailableCapabilities({ 'draft/multiline': 'max-bytes=4096' });
      markCapabilitiesAcknowledged(['draft/multiline']);
      expect(getMultilineLimits()).toBeUndefined();
    });
  });

  describe('privmsgTextBudget', () => {
    it('should leave room for the prefix the server adds when relaying', () => {
      // 510 - ":me!" - 10 user - "@" - 63 host - " PRIVMSG #c :"
      expect(privmsgTextBudget('me', '#c')).toBe(510 - 4 - 10 - 1 - 63 - 13);
    });

    it('should follow the server line length', () => {
      vi.spyOn(networksStore, 'getLineLenLimit').mockReturnValue(1000);
      expect(privmsgTextBudget('me', '#c')).toBe(1000 - 91);
    });

    it('should count the bytes of the nick and target', () => {
      expect(privmsgTextBudget('me', '#ż')).toBe(privmsgTextBudget('me', '#c') - 1);
    });
  });

  describe('splitLine', () => {
    it('should keep a line that fits', () => {
      expect(splitLine('hello world', 11)).toEqual(['hello world']);
    });

    it('should split after the last space that fits, keeping the space', () => {
      expect(splitLine('hello big world', 12)).toEqual(['hello big ', 'world']);
    });

    it('should cut a word longer than the budget', () => {
      expect(splitLine('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    });

    it('should count bytes and never cut inside a character', () => {
      // ż is 2 bytes in UTF-8, 😀 is 4 bytes and 2 UTF-16 units
      expect(splitLine('żżż', 5)).toEqual(['żż', 'ż']);
      expect(splitLine('😀😀', 6)).toEqual(['😀', '😀']);
    });

    it('should give a character larger than the budget a piece of its own', () => {
      expect(splitLine('😀😀', 2)).toEqual(['😀', '😀']);
    });

    it('should not split at a leading space', () => {
      expect(splitLine(' abcdef', 4)).toEqual([' abc', 'def']);
    });

    it('should give the line back when the pieces are joined', () => {
      const line = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, zażółć gęślą jaźń 😀 '.repeat(5);
      const pieces = splitLine(line, 37);
      expect(pieces.join('')).toBe(line);
      for (const piece of pieces) {
        expect(new TextEncoder().encode(piece).length).toBeLessThanOrEqual(37);
      }
    });
  });

  describe('buildPrivmsgs without draft/multiline', () => {
    it('should send one line as one PRIVMSG', () => {
      expect(buildPrivmsgs('me', '#chan', 'hello')).toEqual([{ text: 'hello', lines: ['PRIVMSG #chan :hello'] }]);
    });

    it('should send each line as its own PRIVMSG, skipping blank lines', () => {
      expect(buildPrivmsgs('me', '#chan', 'one\n\ntwo\n')).toEqual([
        { text: 'one', lines: ['PRIVMSG #chan :one'] },
        { text: 'two', lines: ['PRIVMSG #chan :two'] },
      ]);
    });

    it('should put the tags on the first PRIVMSG only', () => {
      expect(buildPrivmsgs('me', '#chan', 'one\ntwo', '@+draft/reply=abc').map((message) => message.lines)).toEqual([
        ['@+draft/reply=abc PRIVMSG #chan :one'],
        ['PRIVMSG #chan :two'],
      ]);
    });

    it('should split a line too long for one PRIVMSG', () => {
      const budget = privmsgTextBudget('me', '#chan');
      const line = `${'a'.repeat(budget - 1)} ${'b'.repeat(10)}`;
      expect(buildPrivmsgs('me', '#chan', line).map((message) => message.text)).toEqual([`${'a'.repeat(budget - 1)} `, 'b'.repeat(10)]);
    });

    it('should send nothing for blank lines only', () => {
      expect(buildPrivmsgs('me', '#chan', '\n\n')).toEqual([]);
    });
  });

  describe('buildPrivmsgs with draft/multiline', () => {
    beforeEach(() => {
      enableMultiline('max-bytes=4096,max-lines=100');
    });

    it('should send a line that fits as a plain PRIVMSG', () => {
      expect(buildPrivmsgs('me', '#chan', 'hello', '@+draft/reply=abc')).toEqual([{ text: 'hello', lines: ['@+draft/reply=abc PRIVMSG #chan :hello'] }]);
    });

    it('should send several lines as one batch with the tags on its opening line', () => {
      const [message, ...others] = buildPrivmsgs('me', '#chan', 'one\n\ntwo', '@+draft/reply=abc');
      const reference = referenceOf(message?.lines[0] ?? '');

      expect(others).toEqual([]);
      expect(reference).not.toBe('');
      expect(message).toEqual({
        text: 'one\n\ntwo',
        lines: [
          `@+draft/reply=abc BATCH +${reference} draft/multiline #chan`,
          `@batch=${reference} PRIVMSG #chan :one`,
          `@batch=${reference} PRIVMSG #chan :`,
          `@batch=${reference} PRIVMSG #chan :two`,
          `BATCH -${reference}`,
        ],
      });
    });

    it('should mark the pieces of a long line as continuing it', () => {
      const budget = privmsgTextBudget('me', '#chan');
      const first = `${'a'.repeat(budget - 1)} `;
      const [message] = buildPrivmsgs('me', '#chan', `${first}bbb`);
      const reference = referenceOf(message?.lines[0] ?? '');

      expect(message?.text).toBe(`${first}bbb`);
      expect(message?.lines.slice(1)).toEqual([
        `@batch=${reference} PRIVMSG #chan :${first}`,
        `@batch=${reference};draft/multiline-concat PRIVMSG #chan :bbb`,
        `BATCH -${reference}`,
      ]);
    });

    it('should drop blank lines at the start and end', () => {
      expect(buildPrivmsgs('me', '#chan', '\n\none\ntwo\n\n').map((message) => message.text)).toEqual(['one\ntwo']);
    });

    it('should send nothing for blank lines only', () => {
      expect(buildPrivmsgs('me', '#chan', '\n\n\n')).toEqual([]);
    });

    it('should use a new batch past max-lines, with the tags on the first only', () => {
      resetCapabilityState();
      enableMultiline('max-bytes=4096,max-lines=2');

      const messages = buildPrivmsgs('me', '#chan', '1\n2\n3\n4\n5', '@+draft/reply=abc');

      expect(messages.map((message) => message.text)).toEqual(['1\n2', '3\n4', '5']);
      expect(messages.map((message) => message.lines[0].startsWith('@+draft/reply=abc '))).toEqual([true, false, false]);
      expect(messages[2]?.lines).toEqual(['PRIVMSG #chan :5']);
    });

    it('should use a new batch past max-bytes, counting the line breaks', () => {
      resetCapabilityState();
      enableMultiline('max-bytes=7');

      // "aaa\nbbb" is 7 bytes; one more line break would make 8
      expect(buildPrivmsgs('me', '#chan', 'aaa\nbbb\nc').map((message) => message.text)).toEqual(['aaa\nbbb', 'c']);
    });

    it('should split lines to fit max-bytes when it is below the line budget', () => {
      resetCapabilityState();
      enableMultiline('max-bytes=4');

      expect(buildPrivmsgs('me', '#chan', 'abcdefgh').map((message) => message.text)).toEqual(['abcd', 'efgh']);
    });

    it('should start a batch cut off mid-line on a line of its own', () => {
      resetCapabilityState();
      enableMultiline('max-bytes=4096,max-lines=2');
      const budget = privmsgTextBudget('me', '#chan');
      const long = 'x'.repeat(budget * 2 + 1);

      const [, second] = buildPrivmsgs('me', '#chan', `a\n${long}`);
      const reference = referenceOf(second?.lines[0] ?? '');

      expect(second?.lines[1]).toBe(`@batch=${reference} PRIVMSG #chan :${'x'.repeat(budget)}`);
      expect(second?.lines[2]).toBe(`@batch=${reference};draft/multiline-concat PRIVMSG #chan :x`);
    });

    it('should not leave a batch of blank lines between two batches', () => {
      resetCapabilityState();
      enableMultiline('max-bytes=4096,max-lines=2');

      expect(buildPrivmsgs('me', '#chan', 'a\nb\n\n\nc').map((message) => message.text)).toEqual(['a\nb', 'c']);
    });

    it('should use a new reference for each batch', () => {
      resetCapabilityState();
      enableMultiline('max-bytes=4096,max-lines=2');

      const [first, second] = buildPrivmsgs('me', '#chan', '1\n2\n3\n4');

      expect(referenceOf(first?.lines[0] ?? '')).not.toBe(referenceOf(second?.lines[0] ?? ''));
    });
  });

  describe('combineMultiline', () => {
    it('should join the lines with line breaks, and continuations without', () => {
      const combined = combineMultiline(batch([privmsg('hello'), privmsg(''), privmsg('wor'), privmsg('ld', { 'draft/multiline-concat': '' })]));
      expect(combined?.line).toEqual(['#chan', ':hello\n\nworld']);
    });

    it('should keep the sender and command and take the tags of the opening line', () => {
      const combined = combineMultiline(batch(
        [privmsg('one', { account: 'friend' }), privmsg('two')],
        { batch: 'history', msgid: 'm1', time: '2026-10-23T10:00:00.000Z', '+draft/reply': 'm0' },
      ));
      expect(combined).toEqual({
        tags: { account: 'friend', msgid: 'm1', time: '2026-10-23T10:00:00.000Z', '+draft/reply': 'm0' },
        sender: 'friend!u@h',
        command: 'PRIVMSG',
        line: ['#chan', ':one\ntwo'],
      });
    });

    it('should combine NOTICE lines', () => {
      expect(combineMultiline(batch([privmsg('one', {}, { command: 'NOTICE' }), privmsg('two', {}, { command: 'NOTICE' })]))?.command).toBe('NOTICE');
    });

    it('should keep the spaces of the lines', () => {
      expect(combineMultiline(batch([privmsg('a  b '), privmsg(' c')]))?.line).toEqual(['#chan', ':a  b \n c']);
    });

    it.each([
      ['no lines', batch([])],
      ['no target', batch([privmsg('one')], {}, [])],
      ['another command', batch([privmsg('one', {}, { command: 'TAGMSG' })])],
      ['mixed commands', batch([privmsg('one'), privmsg('two', {}, { command: 'NOTICE' })])],
      ['another target', batch([privmsg('one'), privmsg('two', {}, { target: '#other' })])],
      ['another sender', batch([privmsg('one'), privmsg('two', {}, { sender: 'other!u@h' })])],
      ['a CTCP line', batch([privmsg('one'), privmsg('\x01ACTION waves\x01')])],
    ])('should not combine a batch with %s', (_name, received) => {
      expect(combineMultiline(received)).toBeUndefined();
    });
  });
});
