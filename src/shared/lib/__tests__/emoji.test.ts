import { describe, expect, it } from 'vitest';
import { splitEmoji } from '../emoji';

describe('splitEmoji', () => {
  it('returns a single non-emoji run for plain text', () => {
    expect(splitEmoji('hello world')).toEqual([{ text: 'hello world', isEmoji: false }]);
  });

  it('returns nothing for empty text', () => {
    expect(splitEmoji('')).toEqual([]);
  });

  it('splits a single trailing emoji', () => {
    expect(splitEmoji('nice 😀')).toEqual([
      { text: 'nice ', isEmoji: false },
      { text: '😀', isEmoji: true },
    ]);
  });

  it('splits a leading emoji', () => {
    expect(splitEmoji('😀 nice')).toEqual([
      { text: '😀', isEmoji: true },
      { text: ' nice', isEmoji: false },
    ]);
  });

  it('splits multiple adjacent emoji into separate runs', () => {
    const runs = splitEmoji('😀😀');
    expect(runs).toEqual([
      { text: '😀', isEmoji: true },
      { text: '😀', isEmoji: true },
    ]);
  });

  it('keeps a ZWJ emoji sequence (family) as one run', () => {
    const family = '👨‍👩‍👧';
    const runs = splitEmoji(`hi ${family}!`);
    expect(runs).toEqual([
      { text: 'hi ', isEmoji: false },
      { text: family, isEmoji: true },
      { text: '!', isEmoji: false },
    ]);
  });

  it('keeps a skin-tone-modified emoji as one run', () => {
    const thumbsUp = '👍🏽';
    const runs = splitEmoji(thumbsUp);
    expect(runs).toEqual([{ text: thumbsUp, isEmoji: true }]);
  });

  it('keeps a flag (regional indicator pair) as one run', () => {
    const flag = '🇵🇱';
    const runs = splitEmoji(`Poland ${flag}`);
    expect(runs).toEqual([
      { text: 'Poland ', isEmoji: false },
      { text: flag, isEmoji: true },
    ]);
  });

  it('does not treat plain digits or punctuation as emoji', () => {
    expect(splitEmoji('#1 42*')).toEqual([{ text: '#1 42*', isEmoji: false }]);
  });
});
