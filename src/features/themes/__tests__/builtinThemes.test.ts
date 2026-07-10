import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES, BUILTIN_THEME_IDS, DEFAULT_THEME_ID, isBuiltinTheme } from '../builtinThemes';

describe('builtinThemes', () => {
  it('should ship classic and modern themes', () => {
    expect(BUILTIN_THEME_IDS).toEqual(['classic', 'modern']);
  });

  it.each(BUILTIN_THEME_IDS)('%s theme should ship non-empty CSS styling .sic-msg', (id) => {
    expect(BUILTIN_THEMES[id].css.length).toBeGreaterThan(0);
    expect(BUILTIN_THEMES[id].css).toContain('.sic-msg');
  });

  it('should identify builtin theme ids', () => {
    expect(isBuiltinTheme('classic')).toBe(true);
    expect(isBuiltinTheme('modern')).toBe(true);
    expect(isBuiltinTheme('some-uuid')).toBe(false);
    expect(isBuiltinTheme('')).toBe(false);
  });

  it('should default to modern', () => {
    expect(DEFAULT_THEME_ID).toBe('modern');
  });
});
