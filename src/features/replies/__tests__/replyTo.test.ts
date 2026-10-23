import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllReplies, clearReplyTo, getReplyTo, setReplyTo } from '../store/replyTo';
import { type Message, MessageCategory } from '@shared/types';

const message = (id: string): Message => ({ id, message: id, target: '#sic', time: '2026-10-23T10:00:00.000Z', category: MessageCategory.default });

describe('replyTo store', () => {
  beforeEach(() => {
    clearAllReplies();
  });

  it('keeps one reply per window', () => {
    setReplyTo('#sic', message('a'));
    setReplyTo('#other', message('b'));
    setReplyTo('#sic', message('c'));

    expect(getReplyTo('#sic')?.id).toBe('c');
    expect(getReplyTo('#other')?.id).toBe('b');
  });

  it('clears one window, or all of them', () => {
    setReplyTo('#sic', message('a'));
    setReplyTo('#other', message('b'));

    clearReplyTo('#sic');
    expect(getReplyTo('#sic')).toBeUndefined();
    expect(getReplyTo('#other')?.id).toBe('b');

    clearAllReplies();
    expect(getReplyTo('#other')).toBeUndefined();
  });
});
