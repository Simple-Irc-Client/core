import { describe, expect, it } from 'vitest';
import { applySpoilerMarkup, isSpoiler, plainText, SPOILER_MASK } from '../spoilers';
import { IRC_FORMAT, parseIrcFormatting, stripIrcFormatting } from '@/shared/lib/ircFormatting';

const style = (foreground: string | null, background: string | null) => ({
  bold: false, italic: false, underline: false, strikethrough: false, monospace: false, reverse: false, foreground, background,
});

describe('spoilers', () => {
  describe('isSpoiler', () => {
    it('is text in its own background color', () => {
      expect(isSpoiler(style('#7F7F7F', '#7F7F7F'))).toBe(true);
      expect(isSpoiler(style('#abcdef', '#ABCDEF'))).toBe(true);
    });

    it('is not text in another color, or without one', () => {
      expect(isSpoiler(style('#000000', '#FFFFFF'))).toBe(false);
      expect(isSpoiler(style('#000000', null))).toBe(false);
      expect(isSpoiler(style(null, null))).toBe(false);
    });
  });

  describe('applySpoilerMarkup', () => {
    it('hides the text between two ||', () => {
      expect(applySpoilerMarkup('the end: ||he dies|| sadly', null)).toBe('the end: \x0314,14he dies\x03 sadly');
    });

    it('hides each pair on its own', () => {
      expect(applySpoilerMarkup('||a|| and ||b||', null)).toBe('\x0314,14a\x03 and \x0314,14b\x03');
    });

    it('closes with default colors before a digit, so the digit stays text', () => {
      const sent = applySpoilerMarkup('the code is ||1234||5678', null);

      expect(sent).toBe('the code is \x0314,141234\x0399,995678');
      expect(stripIrcFormatting(sent)).toBe('the code is 12345678');
      expect(parseIrcFormatting(sent).at(-1)).toEqual({ text: '5678', style: style(null, null) });
    });

    it('goes back to the line color after the spoiler', () => {
      expect(applySpoilerMarkup('||secret|| after', 4)).toBe('\x0314,14secret\x0304,99 after');
    });

    it('leaves an unmatched || as it is', () => {
      expect(applySpoilerMarkup('true || false', null)).toBe('true || false');
      expect(applySpoilerMarkup('||a|| b ||', null)).toBe('\x0314,14a\x03 b ||');
    });

    it('leaves an empty pair as it is', () => {
      expect(applySpoilerMarkup('||||', null)).toBe('||||');
    });

    it('sends an escaped || as a literal one', () => {
      expect(applySpoilerMarkup(String.raw`exit \|| 1 and \||x\||`, null)).toBe('exit || 1 and ||x||');
      expect(applySpoilerMarkup(String.raw`||a \|| b||`, null)).toBe('\x0314,14a || b\x03');
    });

    it('leaves text without || untouched', () => {
      expect(applySpoilerMarkup('a | b', null)).toBe('a | b');
    });
  });
});

describe('plainText', () => {
  it('should drop formatting', () => {
    expect(plainText(`${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD} and ${IRC_FORMAT.COLOR}04red`)).toBe('bold and red');
  });

  it('should mask a spoiler, however it is styled inside', () => {
    expect(plainText(applySpoilerMarkup(`it was ||the ${IRC_FORMAT.BOLD}butler${IRC_FORMAT.BOLD}|| all along`, null))).toBe(`it was ${SPOILER_MASK} all along`);
  });

  it('should mask each of two spoilers apart', () => {
    expect(plainText(applySpoilerMarkup('||one|| and ||two||', null))).toBe(`${SPOILER_MASK} and ${SPOILER_MASK}`);
  });

  it('should leave plain text as it is', () => {
    expect(plainText('plain || text')).toBe('plain || text');
  });
});
