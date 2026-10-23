import { describe, expect, it } from 'vitest';
import { collapseMembershipEvents, IDLE_WINDOW_MS, summarizeEvents, type ChatItem, type MembershipEventsDisplay } from '../membershipEvents';
import { MessageCategory, type Message } from '@shared/types';

const fold = (nick: string): string => nick.toLowerCase();
const START = Date.parse('2026-10-24T12:00:00.000Z');

let nextId = 0;
const at = (minutes: number): string => new Date(START + minutes * 60_000).toISOString();

const event = (category: 'join' | 'part' | 'quit', nick: string, minutes = 0): Message => ({
  id: `m${nextId++}`,
  message: `${nick} ${category}`,
  nick,
  target: '#chan',
  time: at(minutes),
  category: MessageCategory[category],
});

const rename = (from: string, to: string, minutes = 0): Message => ({
  id: `m${nextId++}`,
  message: `${from} is now ${to}`,
  target: '#chan',
  time: at(minutes),
  category: MessageCategory.info,
  renamed: { from, to },
});

const said = (nick: string, minutes = 0, category: MessageCategory = MessageCategory.default): Message => ({
  id: `m${nextId++}`,
  message: 'hello',
  nick,
  target: '#chan',
  time: at(minutes),
  category,
});

const collapse = (messages: Message[], display: MembershipEventsDisplay = 'collapse'): ChatItem[] =>
  collapseMembershipEvents(messages, { display, fold, myNick: 'Me' });

/** Each item as the ids it shows: a message's id, or a run's ids in brackets */
const shape = (items: ChatItem[]): (string | string[])[] =>
  items.map((item) => (item.kind === 'message' ? item.message.id : item.messages.map(({ id }) => id)));

describe('collapseMembershipEvents', () => {
  it('should collapse joins, parts, quits and nick changes in a row into one item', () => {
    const messages = [said('alice'), event('join', 'bob'), event('part', 'carol'), rename('dave', 'dave_'), event('quit', 'erin'), said('alice')];

    const items = collapse(messages);

    expect(shape(items)).toEqual([messages[0]?.id, [messages[1]?.id, messages[2]?.id, messages[3]?.id, messages[4]?.id], messages[5]?.id]);
    expect(items[1]).toMatchObject({ kind: 'events', id: messages[1]?.id });
  });

  it('should leave a lone event as a message', () => {
    const messages = [said('alice'), event('join', 'bob'), said('bob')];

    expect(shape(collapse(messages))).toEqual(messages.map(({ id }) => id));
  });

  it.each([
    ['a kick', { ...event('part', 'x'), category: MessageCategory.kick }],
    ['a mode change', { ...said('op'), category: MessageCategory.mode }],
    ['a notice', said('bob', 0, MessageCategory.notice)],
    ['an info line', { ...said('server'), category: MessageCategory.info, nick: undefined }],
  ])('should end a run at %s', (_, breaker) => {
    const messages = [event('join', 'a'), event('join', 'b'), breaker, event('join', 'c'), event('join', 'd')];

    expect(shape(collapse(messages))).toEqual([[messages[0]?.id, messages[1]?.id], breaker.id, [messages[3]?.id, messages[4]?.id]]);
  });

  it('should end a run at a day change', () => {
    const lateEvening = new Date(2026, 9, 24, 23, 59).toISOString();
    const nextMorning = new Date(2026, 9, 25, 0, 1).toISOString();
    const messages = [{ ...event('join', 'a'), time: lateEvening }, { ...event('join', 'b'), time: lateEvening }, { ...event('join', 'c'), time: nextMorning }];

    expect(shape(collapse(messages))).toEqual([[messages[0]?.id, messages[1]?.id], messages[2]?.id]);
  });

  it('should not treat a nickless join line (e.g. an old server text) as an event', () => {
    const messages = [{ ...event('join', 'a'), nick: undefined }, { ...event('join', 'b'), nick: undefined }];

    expect(shape(collapse(messages))).toEqual(messages.map(({ id }) => id));
  });

  it('should show everything as it is with "all"', () => {
    const messages = [event('join', 'a'), event('join', 'b')];

    expect(shape(collapse(messages, 'all'))).toEqual(messages.map(({ id }) => id));
  });

  it('should handle no messages', () => {
    expect(collapse([])).toEqual([]);
  });

  describe('hiding idle people', () => {
    it('should hide the events of people who wrote nothing near them', () => {
      const messages = [event('join', 'lurker', 0), event('part', 'lurker', 5), said('alice', 10)];

      expect(shape(collapse(messages, 'collapseHideIdle'))).toEqual([messages[2]?.id]);
    });

    it('should keep the events of someone who wrote within the window, before or after', () => {
      const messages = [
        said('talker', 0),
        event('quit', 'talker', IDLE_WINDOW_MS / 60_000),
        event('join', 'newcomer', 40),
        event('join', 'lurker', 40),
        said('Newcomer', 41),
      ];

      expect(shape(collapse(messages, 'collapseHideIdle'))).toEqual([messages[0]?.id, [messages[1]?.id, messages[2]?.id], messages[4]?.id]);
    });

    it('should hide an event just past the window', () => {
      const messages = [said('talker', 0), event('quit', 'talker', IDLE_WINDOW_MS / 60_000 + 1)];

      expect(shape(collapse(messages, 'collapseHideIdle'))).toEqual([messages[0]?.id]);
    });

    it('should count a nick change as active under either nick', () => {
      const messages = [rename('old', 'new', 0), rename('quiet', 'silent', 0), said('new', 5)];

      expect(shape(collapse(messages, 'collapseHideIdle'))).toEqual([messages[0]?.id, messages[2]?.id]);
    });

    it('should never hide our own events', () => {
      const messages = [event('join', 'me', 0), event('join', 'lurker', 0)];

      expect(shape(collapse(messages, 'collapseHideIdle'))).toEqual([messages[0]?.id]);
    });

    it('should not count a join as writing', () => {
      const messages = [event('join', 'a', 0), event('part', 'a', 1), event('join', 'a', 2)];

      expect(collapse(messages, 'collapseHideIdle')).toEqual([]);
    });
  });
});

describe('summarizeEvents', () => {
  it('should sort people by what they ended up doing', () => {
    const summary = summarizeEvents([
      event('join', 'alice'),
      event('join', 'bob'),
      event('part', 'carol'),
      event('quit', 'dave'),
      event('join', 'erin'),
      event('part', 'Erin'),
      event('quit', 'frank'),
      event('join', 'frank'),
    ], fold);

    expect(summary).toEqual({ joined: ['alice', 'bob'], left: ['carol', 'dave'], joinedAndLeft: ['erin'], rejoined: ['frank'], renamed: [] });
  });

  it('should follow a person through nick changes', () => {
    const summary = summarizeEvents([event('join', 'alice'), rename('alice', 'alice_'), rename('alice_', 'ally'), event('part', 'ally'), rename('bob', 'robert')], fold);

    expect(summary).toEqual({ joined: [], left: [], joinedAndLeft: ['ally'], rejoined: [], renamed: [{ from: 'alice', to: 'ally' }, { from: 'bob', to: 'robert' }] });
  });

  it('should leave out a nick changed and changed back', () => {
    const summary = summarizeEvents([rename('bob', 'bob_away'), rename('bob_away', 'Bob')], fold);

    expect(summary.renamed).toEqual([]);
  });
});
