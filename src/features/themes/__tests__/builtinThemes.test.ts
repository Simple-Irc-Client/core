import { describe, expect, it } from 'vitest';
import { BUILTIN_LAYOUT_CSS, BUILTIN_PALETTES, BUILTIN_THEMES, BUILTIN_THEME_IDS, DEFAULT_THEME_ID, isBuiltinTheme } from '../builtinThemes';
import { DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS, IRC_DARK_COLORS, IRC_LIGHT_COLORS, MSG_COLOR_KEYS } from '../palette';

describe('builtinThemes', () => {
  it('should ship classic, modern and irc themes', () => {
    expect(BUILTIN_THEME_IDS).toEqual(['classic', 'modern', 'irc']);
  });

  it.each(BUILTIN_THEME_IDS)('%s theme should ship non-empty CSS styling .sic-msg', (id) => {
    expect(BUILTIN_THEMES[id].css.length).toBeGreaterThan(0);
    expect(BUILTIN_THEMES[id].css).toContain('.sic-msg');
  });

  it('should identify builtin theme ids', () => {
    expect(isBuiltinTheme('classic')).toBe(true);
    expect(isBuiltinTheme('modern')).toBe(true);
    expect(isBuiltinTheme('irc')).toBe(true);
    expect(isBuiltinTheme('some-uuid')).toBe(false);
    expect(isBuiltinTheme('')).toBe(false);
    // Object.prototype keys are not themes
    expect(isBuiltinTheme('toString')).toBe(false);
    expect(isBuiltinTheme('constructor')).toBe(false);
  });

  it('should default to modern', () => {
    expect(DEFAULT_THEME_ID).toBe('modern');
  });

  it.each(BUILTIN_THEME_IDS)('%s theme CSS should be its layout followed by its own palette', (id) => {
    const css = BUILTIN_THEMES[id].css;
    expect(css.startsWith(BUILTIN_LAYOUT_CSS[id].trimEnd())).toBe(true);
    // The palette block comes last so it wins over any --msg-* the layout sets
    const lightBlock = css.slice(css.lastIndexOf(':root {'));
    for (const key of MSG_COLOR_KEYS) {
      expect(lightBlock).toContain(`--msg-${key}: ${BUILTIN_PALETTES[id].light[key]};`);
    }
    const darkBlock = css.slice(css.lastIndexOf('.dark {'));
    for (const key of MSG_COLOR_KEYS) {
      expect(darkBlock).toContain(`--msg-${key}: ${BUILTIN_PALETTES[id].dark[key]};`);
    }
  });

  it('should keep the default palette for classic and modern', () => {
    expect(BUILTIN_PALETTES.classic).toEqual({ light: DEFAULT_LIGHT_COLORS, dark: DEFAULT_DARK_COLORS });
    expect(BUILTIN_PALETTES.modern).toEqual({ light: DEFAULT_LIGHT_COLORS, dark: DEFAULT_DARK_COLORS });
  });

  describe('irc theme', () => {
    const layout = BUILTIN_LAYOUT_CSS.irc;

    it('should ship the website palette', () => {
      expect(BUILTIN_PALETTES.irc).toEqual({ light: IRC_LIGHT_COLORS, dark: IRC_DARK_COLORS });
    });

    it('should retheme the whole app in light and dark mode', () => {
      expect(layout).toMatch(/:root \{[^}]*--background: #fbfaf7;/);
      expect(layout).toMatch(/:root \{[^}]*--primary: #b0520a;/);
      expect(layout).toMatch(/\.dark \{[^}]*--background: #141311;/);
      expect(layout).toMatch(/\.dark \{[^}]*--primary: #f29a45;/);
    });

    it('should switch the app font to monospace', () => {
      expect(layout).toMatch(/:root \{[^}]*--font-sans: [^;]*monospace;/);
    });

    it('should use a single-line layout without avatars', () => {
      expect(layout).toMatch(/\.sic-msg-gutter,[^{]*\{\s*display: none;/);
    });
  });
});
