import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { searchMessages } from '../search';
import { ChannelCategory, MessageCategory, type ChannelExtended } from '@shared/types';

const window = (texts: string[]): ChannelExtended => ({
  name: '#any',
  category: ChannelCategory.channel,
  unReadMessages: 0,
  messages: texts.map((text, index) => ({ id: `m${index}`, message: text, target: '#any', time: new Date(index * 1000).toISOString(), category: MessageCategory.default })),
  topic: '',
  topicSetBy: '',
  topicSetTime: 0,
  typing: [],
});

describe('searching, for any messages and query', () => {
  it('every match marks the query in the text, ignoring case', () => {
    fc.assert(fc.property(fc.array(fc.string({ maxLength: 30 }), { maxLength: 10 }), fc.string({ minLength: 1, maxLength: 4 }), (texts, query) => {
      const needle = query.trim();
      for (const { text, matches } of searchMessages([window(texts)], query)) {
        expect(matches.length).toBeGreaterThan(0);
        for (const [start, end] of matches) {
          expect(text.slice(start, end).toLowerCase()).toBe(needle.toLowerCase());
        }
      }
    }));
  });

  it('finds every message that holds the query, newest first', () => {
    fc.assert(fc.property(fc.array(fc.stringMatching(/^[a-z ]{0,20}$/), { maxLength: 10 }), fc.stringMatching(/^[a-z]{1,3}$/), (texts, query) => {
      const found = searchMessages([window(texts)], query).map(({ message }) => message.id);
      const expected = texts.map((text, index) => [text, `m${index}`] as const).filter(([text]) => text.includes(query)).map(([, id]) => id).reverse();
      expect(found).toEqual(expected);
    }));
  });
});
