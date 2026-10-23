import { describe, expect, it } from 'vitest';
import { containsHighlight } from '../highlight';

describe('containsHighlight', () => {
  it('should find a term standing as a word', () => {
    expect(containsHighlight('hey Piotr, look', ['Piotr'])).toBe(true);
    expect(containsHighlight('Piotr: look', ['Piotr'])).toBe(true);
    expect(containsHighlight('look piotr', ['Piotr'])).toBe(true);
  });

  it('should ignore case, also beyond ASCII', () => {
    expect(containsHighlight('ŁUKASZ tu?', ['łukasz'])).toBe(true);
  });

  it('should not find a term inside another word', () => {
    expect(containsHighlight('also here', ['al'])).toBe(false);
    expect(containsHighlight('Piotrek', ['Piotr'])).toBe(false);
    expect(containsHighlight('zażółć', ['żół'])).toBe(false);
  });

  it('should find a term next to punctuation or IRC formatting', () => {
    expect(containsHighlight('(deploy)', ['deploy'])).toBe(true);
    expect(containsHighlight('\x02deploy\x02 done', ['deploy'])).toBe(true);
    expect(containsHighlight('ping nick_', ['nick'])).toBe(true);
  });

  it('should treat regular expression characters literally', () => {
    expect(containsHighlight('use c++ here', ['c++'])).toBe(true);
    expect(containsHighlight('use cpp here', ['c++'])).toBe(false);
    expect(containsHighlight('[away] me', ['[away]'])).toBe(true);
    expect(containsHighlight('anything', ['.*'])).toBe(false);
  });

  it('should find a phrase of several words', () => {
    expect(containsHighlight('the build is broken again', ['build is broken'])).toBe(true);
  });

  it('should find any one of several terms, including a longer one sharing a start', () => {
    expect(containsHighlight('release tomorrow', ['deploy', 'release'])).toBe(true);
    expect(containsHighlight('foobar', ['foo', 'foobar'])).toBe(true);
  });

  it('should ignore blank terms', () => {
    expect(containsHighlight('any text', [])).toBe(false);
    expect(containsHighlight('any text', ['', '   '])).toBe(false);
    expect(containsHighlight('any text', ['  text '])).toBe(true);
  });
});
