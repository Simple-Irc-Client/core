import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES } from '../builtinThemes';
import { getActiveThemeCss, getThemeList, resolveThemeCss, type ThemeSlice } from '../themeSelectors';

const makeState = (overrides: Partial<ThemeSlice> = {}): ThemeSlice => ({
  theme: 'modern',
  customThemes: {},
  builtinThemeOverrides: {},
  ...overrides,
});

describe('resolveThemeCss', () => {
  it('should return the shipped CSS for builtin themes', () => {
    const state = makeState();

    expect(resolveThemeCss(state, 'classic')).toBe(BUILTIN_THEMES.classic.css);
    expect(resolveThemeCss(state, 'modern')).toBe(BUILTIN_THEMES.modern.css);
  });

  it('should prefer a builtin override over the shipped CSS', () => {
    const state = makeState({ builtinThemeOverrides: { classic: '.override {}' } });

    expect(resolveThemeCss(state, 'classic')).toBe('.override {}');
    expect(resolveThemeCss(state, 'modern')).toBe(BUILTIN_THEMES.modern.css);
  });

  it('should return the custom theme CSS by id', () => {
    const state = makeState({ customThemes: { 'id-1': { name: 'Neon', css: '.neon {}' } } });

    expect(resolveThemeCss(state, 'id-1')).toBe('.neon {}');
  });

  it('should fall back to the modern default for unknown ids', () => {
    const state = makeState();

    expect(resolveThemeCss(state, 'deleted-theme-id')).toBe(BUILTIN_THEMES.modern.css);
  });
});

describe('getActiveThemeCss', () => {
  it('should resolve the CSS of the active theme', () => {
    const state = makeState({ theme: 'id-1', customThemes: { 'id-1': { name: 'Neon', css: '.neon {}' } } });

    expect(getActiveThemeCss(state)).toBe('.neon {}');
  });
});

describe('getThemeList', () => {
  const t = (key: string) => key.split('.').pop() ?? key;

  it('should list builtins first, then custom themes sorted by name', () => {
    const state = makeState({
      customThemes: {
        'id-b': { name: 'Zebra', css: '' },
        'id-a': { name: 'Aqua', css: '' },
      },
    });

    const list = getThemeList(state, t);

    expect(list.map((item) => item.id)).toEqual(['classic', 'modern', 'id-a', 'id-b']);
    expect(list[0]).toEqual({ id: 'classic', name: 'layoutClassic', builtin: true, overridden: false });
    expect(list[2]).toEqual({ id: 'id-a', name: 'Aqua', builtin: false, overridden: false });
  });

  it('should mark overridden builtins', () => {
    const state = makeState({ builtinThemeOverrides: { modern: '.x {}' } });

    const list = getThemeList(state, t);

    expect(list.find((item) => item.id === 'modern')?.overridden).toBe(true);
    expect(list.find((item) => item.id === 'classic')?.overridden).toBe(false);
  });
});
