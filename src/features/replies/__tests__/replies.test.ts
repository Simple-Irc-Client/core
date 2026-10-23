import { afterEach, describe, expect, it, vi } from 'vitest';
import { quoteLine, replyTags } from '../replies';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import * as settingsFile from '@features/settings/store/settings';
import { type Message, MessageCategory } from '@shared/types';

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  msgid: 'm1',
  message: 'the question',
  nick: 'alice',
  target: '#sic',
  time: '2026-10-23T10:00:00.000Z',
  category: MessageCategory.default,
  ...overrides,
});

describe('replies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetCapabilityState();
  });

  describe('replyTags', () => {
    it('refers to the message by its msgid', () => {
      markCapabilitiesAcknowledged(['message-tags']);

      expect(replyTags(message())).toBe('@+draft/reply=m1');
    });

    it('escapes the msgid for the tag', () => {
      markCapabilitiesAcknowledged(['message-tags']);

      expect(replyTags(message({ msgid: 'a;b c' }))).toBe(String.raw`@+draft/reply=a\:b\sc`);
    });

    it.each([
      ['without message-tags', () => {}, message()],
      ['when the server drops the tag', () => {
        markCapabilitiesAcknowledged(['message-tags']);
        vi.spyOn(settingsFile, 'getClientTagDeny').mockReturnValue(['*', '-typing']);
      }, message()],
      ['for a message without a msgid', () => markCapabilitiesAcknowledged(['message-tags']), message({ msgid: undefined })],
    ])('has none %s', (_case, arrange, replied) => {
      arrange();

      expect(replyTags(replied)).toBeUndefined();
    });
  });

  describe('quoteLine', () => {
    it('quotes the nick and the text', () => {
      expect(quoteLine(message())).toBe('> <alice> the question');
    });

    it('uses the nick, not the display name, from a user snapshot', () => {
      expect(quoteLine(message({ nick: { nick: 'alice', displayName: 'Alice A.', ident: '', hostname: '', flags: [], channels: [] } }))).toBe('> <alice> the question');
    });

    it('keeps it to one plain line', () => {
      expect(quoteLine(message({ message: '\x02bold\x02 and\n\x0304red\x03   text ' }))).toBe('> <alice> bold and red text');
    });

    it('shortens a long message', () => {
      const line = quoteLine(message({ message: 'x'.repeat(500) }));

      expect(line).toBe(`> <alice> ${'x'.repeat(119)}…`);
    });
  });
});
