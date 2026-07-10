import classicCss from './builtin/classic.css?raw';
import modernCss from './builtin/modern.css?raw';
import { buildPaletteCss, DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS } from './palette';

export type BuiltinThemeId = 'classic' | 'modern';

export const DEFAULT_THEME_ID: BuiltinThemeId = 'modern';

/** Layout-only CSS of the builtin themes (the .css files), without the palette. */
export const BUILTIN_LAYOUT_CSS: Record<BuiltinThemeId, string> = {
  classic: classicCss,
  modern: modernCss,
};

// A builtin theme's CSS = layout rules + the default message-color palette,
// so the CSS editor shows the --msg-* colors ready to tweak (the same values
// the Theme Creator's pickers edit)
const withPalette = (layoutCss: string): string =>
  `${layoutCss.trimEnd()}\n\n${buildPaletteCss(DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS)}\n`;

export const BUILTIN_THEMES: Record<BuiltinThemeId, { nameKey: string; css: string }> = {
  classic: { nameKey: 'profileSettings.layoutClassic', css: withPalette(classicCss) },
  modern: { nameKey: 'profileSettings.layoutModern', css: withPalette(modernCss) },
};

export const BUILTIN_THEME_IDS = Object.keys(BUILTIN_THEMES) as BuiltinThemeId[];

export const isBuiltinTheme = (id: string): id is BuiltinThemeId => id in BUILTIN_THEMES;
