import { describe, expect, it } from 'vitest';
import {
  parseIrcFormatting,
  hasIrcFormatting,
  stripIrcFormatting,
  IRC_FORMAT,
} from '../ircFormatting';

describe('ircFormatting', () => {
  describe('hasIrcFormatting', () => {
    it('should return false for plain text', () => {
      expect(hasIrcFormatting('Hello world')).toBe(false);
    });

    it('should return true for text with bold', () => {
      expect(hasIrcFormatting(`${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD}`)).toBe(true);
    });

    it('should return true for text with color codes', () => {
      expect(hasIrcFormatting(`${IRC_FORMAT.COLOR}4red`)).toBe(true);
    });

    it('should return true for text with hex color', () => {
      expect(hasIrcFormatting(`${IRC_FORMAT.HEX_COLOR}FF0000red`)).toBe(true);
    });
  });

  describe('stripIrcFormatting', () => {
    it('should return plain text unchanged', () => {
      expect(stripIrcFormatting('Hello world')).toBe('Hello world');
    });

    it('should strip bold formatting', () => {
      expect(stripIrcFormatting(`${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD} text`)).toBe('bold text');
    });

    it('should strip italic formatting', () => {
      expect(stripIrcFormatting(`${IRC_FORMAT.ITALIC}italic${IRC_FORMAT.ITALIC}`)).toBe('italic');
    });

    it('should strip color codes with numbers', () => {
      expect(stripIrcFormatting(`${IRC_FORMAT.COLOR}4red${IRC_FORMAT.COLOR} text`)).toBe('red text');
    });

    it('should strip color codes with foreground and background', () => {
      expect(stripIrcFormatting(`${IRC_FORMAT.COLOR}4,2red on blue`)).toBe('red on blue');
    });

    it('should strip hex color codes', () => {
      expect(stripIrcFormatting(`${IRC_FORMAT.HEX_COLOR}FF0000red`)).toBe('red');
    });

    it('should strip all formatting types', () => {
      const formatted = `${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD} ${IRC_FORMAT.ITALIC}italic${IRC_FORMAT.ITALIC} ${IRC_FORMAT.UNDERLINE}underline${IRC_FORMAT.UNDERLINE}`;
      expect(stripIrcFormatting(formatted)).toBe('bold italic underline');
    });

    it('should strip reset character', () => {
      expect(stripIrcFormatting(`formatted${IRC_FORMAT.RESET} normal`)).toBe('formatted normal');
    });
  });

  describe('parseIrcFormatting', () => {
    describe('plain text', () => {
      it('should parse plain text as a single segment', () => {
        const result = parseIrcFormatting('Hello world');
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('Hello world');
        expect(result[0]!.style.bold).toBe(false);
        expect(result[0]!.style.italic).toBe(false);
      });

      it('should handle empty string', () => {
        const result = parseIrcFormatting('');
        expect(result).toHaveLength(0);
      });
    });

    describe('bold formatting', () => {
      it('should parse bold text', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('bold');
        expect(result[0]!.style.bold).toBe(true);
      });

      it('should parse text with bold in middle', () => {
        const result = parseIrcFormatting(`normal ${IRC_FORMAT.BOLD}bold${IRC_FORMAT.BOLD} normal`);
        expect(result).toHaveLength(3);
        expect(result[0]!.text).toBe('normal ');
        expect(result[0]!.style.bold).toBe(false);
        expect(result[1]!.text).toBe('bold');
        expect(result[1]!.style.bold).toBe(true);
        expect(result[2]!.text).toBe(' normal');
        expect(result[2]!.style.bold).toBe(false);
      });
    });

    describe('italic formatting', () => {
      it('should parse italic text', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.ITALIC}italic${IRC_FORMAT.ITALIC}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('italic');
        expect(result[0]!.style.italic).toBe(true);
      });
    });

    describe('underline formatting', () => {
      it('should parse underlined text', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.UNDERLINE}underline${IRC_FORMAT.UNDERLINE}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('underline');
        expect(result[0]!.style.underline).toBe(true);
      });
    });

    describe('strikethrough formatting', () => {
      it('should parse strikethrough text', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.STRIKETHROUGH}strike${IRC_FORMAT.STRIKETHROUGH}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('strike');
        expect(result[0]!.style.strikethrough).toBe(true);
      });
    });

    describe('monospace formatting', () => {
      it('should parse monospace text', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.MONOSPACE}code${IRC_FORMAT.MONOSPACE}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('code');
        expect(result[0]!.style.monospace).toBe(true);
      });
    });

    describe('color formatting', () => {
      it('should parse single digit foreground color', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}4red`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('red');
        expect(result[0]!.style.foreground).toBe('#FF0000');
      });

      it('should parse two digit foreground color', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}12blue`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('blue');
        expect(result[0]!.style.foreground).toBe('#0000FC');
      });

      it('should parse foreground and background colors', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}4,2text`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('text');
        expect(result[0]!.style.foreground).toBe('#FF0000');
        expect(result[0]!.style.background).toBe('#00007F');
      });

      it('should reset colors with bare color code', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}4red${IRC_FORMAT.COLOR} normal`);
        expect(result).toHaveLength(2);
        expect(result[0]!.style.foreground).toBe('#FF0000');
        expect(result[1]!.text).toBe(' normal');
        expect(result[1]!.style.foreground).toBe(null);
      });

      it('should handle extended color codes (16-98)', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}52text`);
        expect(result).toHaveLength(1);
        expect(result[0]!.style.foreground).toBe('#ff0000');
      });

      it('should handle color code 99 as default', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}99text`);
        expect(result).toHaveLength(1);
        expect(result[0]!.style.foreground).toBe(null);
      });
    });

    describe('hex color formatting', () => {
      it('should parse hex foreground color', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.HEX_COLOR}FF5500orange`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('orange');
        expect(result[0]!.style.foreground).toBe('#FF5500');
      });

      it('should parse hex foreground and background colors', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.HEX_COLOR}FF0000,0000FFtext`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('text');
        expect(result[0]!.style.foreground).toBe('#FF0000');
        expect(result[0]!.style.background).toBe('#0000FF');
      });

      it('should handle lowercase hex colors', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.HEX_COLOR}ff5500orange`);
        expect(result).toHaveLength(1);
        expect(result[0]!.style.foreground).toBe('#ff5500');
      });
    });

    describe('reverse formatting', () => {
      it('should toggle reverse mode', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.REVERSE}reversed${IRC_FORMAT.REVERSE}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('reversed');
        expect(result[0]!.style.reverse).toBe(true);
      });
    });

    describe('reset formatting', () => {
      it('should reset all formatting', () => {
        const result = parseIrcFormatting(
          `${IRC_FORMAT.BOLD}${IRC_FORMAT.ITALIC}${IRC_FORMAT.COLOR}4formatted${IRC_FORMAT.RESET} normal`
        );
        expect(result).toHaveLength(2);
        expect(result[0]!.style.bold).toBe(true);
        expect(result[0]!.style.italic).toBe(true);
        expect(result[0]!.style.foreground).toBe('#FF0000');
        expect(result[1]!.text).toBe(' normal');
        expect(result[1]!.style.bold).toBe(false);
        expect(result[1]!.style.italic).toBe(false);
        expect(result[1]!.style.foreground).toBe(null);
      });
    });

    describe('combined formatting', () => {
      it('should handle multiple styles on same text', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.BOLD}${IRC_FORMAT.ITALIC}bold italic`);
        expect(result).toHaveLength(1);
        expect(result[0]!.style.bold).toBe(true);
        expect(result[0]!.style.italic).toBe(true);
      });

      it('should handle nested formatting changes', () => {
        const result = parseIrcFormatting(
          `${IRC_FORMAT.BOLD}bold ${IRC_FORMAT.ITALIC}bold+italic${IRC_FORMAT.BOLD} italic`
        );
        expect(result).toHaveLength(3);
        expect(result[0]!.style.bold).toBe(true);
        expect(result[0]!.style.italic).toBe(false);
        expect(result[1]!.style.bold).toBe(true);
        expect(result[1]!.style.italic).toBe(true);
        expect(result[2]!.style.bold).toBe(false);
        expect(result[2]!.style.italic).toBe(true);
      });

      it('should handle color with bold', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.BOLD}${IRC_FORMAT.COLOR}4bold red`);
        expect(result).toHaveLength(1);
        expect(result[0]!.style.bold).toBe(true);
        expect(result[0]!.style.foreground).toBe('#FF0000');
      });
    });

    describe('edge cases', () => {
      it('should handle formatting codes at end of string', () => {
        const result = parseIrcFormatting(`text${IRC_FORMAT.BOLD}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('text');
      });

      it('should handle consecutive formatting codes', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.BOLD}${IRC_FORMAT.BOLD}text`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('text');
        expect(result[0]!.style.bold).toBe(false);
      });

      it('should handle incomplete color code at end', () => {
        const result = parseIrcFormatting(`text${IRC_FORMAT.COLOR}`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('text');
      });

      it('should handle color code followed by non-digit', () => {
        const result = parseIrcFormatting(`${IRC_FORMAT.COLOR}text`);
        expect(result).toHaveLength(1);
        expect(result[0]!.text).toBe('text');
        expect(result[0]!.style.foreground).toBe(null);
      });
    });
  });
});
