import { describe, expect, it } from 'vitest';
import { buildChatRows, type ChatRowsOptions } from '../chatRows';
import { MessageCategory, type Message } from '@shared/types';

const fold = (nick: string): string => nick.toLowerCase();
const options: ChatRowsOptions = { isDebug: false, membershipEvents: 'all', fold, myNick: 'me' };

let nextId = 0;
const said = (nick: string, time: string, extra: Partial<Message> = {}): Message => ({
  id: `m${nextId++}`,
  message: 'hello',
  nick,
  target: '#chan',
  time,
  category: MessageCategory.default,
  ...extra,
});

const grouping = (messages: Message[], rowOptions = options): boolean[] => buildChatRows(messages, rowOptions).map((row) => row.grouped);

describe('buildChatRows', () => {
  it('groups a message under the previous one from the same author', () => {
    expect(grouping([said('alice', '2026-10-25T10:00:00'), said('alice', '2026-10-25T10:01:00')])).toEqual([false, true]);
  });

  it('starts a new group for another author', () => {
    expect(grouping([said('alice', '2026-10-25T10:00:00'), said('bob', '2026-10-25T10:01:00')])).toEqual([false, false]);
  });

  it('starts a new group after five minutes without a word', () => {
    expect(grouping([said('alice', '2026-10-25T10:00:00'), said('alice', '2026-10-25T10:05:01')])).toEqual([false, false]);
  });

  it('gives a reply a header of its own, to show what it answers above it', () => {
    expect(grouping([said('alice', '2026-10-25T10:00:00'), said('alice', '2026-10-25T10:01:00', { replyTo: 'earlier' })])).toEqual([false, false]);
  });

  it('puts a date separator above the first message of another day, and starts a group there', () => {
    const rows = buildChatRows([said('alice', '2026-10-25T23:59:00'), said('alice', '2026-10-26T00:01:00')], options);

    expect(rows.map((row) => row.showDateSeparator)).toEqual([false, true]);
    expect(rows.map((row) => row.grouped)).toEqual([false, false]);
  });

  it('groups nothing in Status and Debug', () => {
    expect(grouping([said('alice', '2026-10-25T10:00:00'), said('alice', '2026-10-25T10:01:00')], { ...options, isDebug: true })).toEqual([false, false]);
  });

  it('does not group a message under a line that is not chat', () => {
    const info = said('alice', '2026-10-25T10:00:00', { category: MessageCategory.info });

    expect(grouping([info, said('alice', '2026-10-25T10:01:00')])).toEqual([false, false]);
  });
});
