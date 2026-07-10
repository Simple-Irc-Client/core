import { BUILTIN_THEMES, BUILTIN_THEME_IDS, DEFAULT_THEME_ID, isBuiltinTheme, type BuiltinThemeId } from './builtinThemes';

export interface CustomTheme {
  name: string;
  css: string;
}

/** The theme-related slice of the settings store. */
export interface ThemeSlice {
  theme: string;
  customThemes: Record<string, CustomTheme>;
  builtinThemeOverrides: Partial<Record<BuiltinThemeId, string>>;
}

export interface ThemeListItem {
  id: string;
  name: string;
  builtin: boolean;
  overridden: boolean;
}

export const getThemeList = (state: ThemeSlice, t: (key: string) => string): ThemeListItem[] => [
  ...BUILTIN_THEME_IDS.map((id) => ({
    id,
    name: t(BUILTIN_THEMES[id].nameKey),
    builtin: true,
    overridden: state.builtinThemeOverrides[id] !== undefined,
  })),
  ...Object.entries(state.customThemes)
    .map(([id, { name }]) => ({ id, name, builtin: false, overridden: false }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];

export const resolveThemeCss = (state: ThemeSlice, id: string): string => {
  if (isBuiltinTheme(id)) {
    return state.builtinThemeOverrides[id] ?? BUILTIN_THEMES[id].css;
  }
  return state.customThemes[id]?.css ?? BUILTIN_THEMES[DEFAULT_THEME_ID].css;
};

export const getActiveThemeCss = (state: ThemeSlice): string => resolveThemeCss(state, state.theme);
