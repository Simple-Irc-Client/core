import classicCss from './builtin/classic.css?raw';
import modernCss from './builtin/modern.css?raw';
import ircCss from './builtin/irc.css?raw';
import {
  buildPaletteCss,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  IRC_DARK_COLORS,
  IRC_LIGHT_COLORS,
  type MsgColorPalette,
} from './palette';

export type BuiltinThemeId = 'classic' | 'modern' | 'irc';

export const DEFAULT_THEME_ID: BuiltinThemeId = 'modern';

interface BuiltinThemeDefinition {
  nameKey: string;
  /** Layout-only CSS (the .css file), without the palette. */
  layoutCss: string;
  /** The message-color palette the theme ships with. */
  palette: { light: MsgColorPalette; dark: MsgColorPalette };
}

const DEFAULT_PALETTE = { light: DEFAULT_LIGHT_COLORS, dark: DEFAULT_DARK_COLORS };

const DEFINITIONS: Record<BuiltinThemeId, BuiltinThemeDefinition> = {
  classic: { nameKey: 'profileSettings.layoutClassic', layoutCss: classicCss, palette: DEFAULT_PALETTE },
  modern: { nameKey: 'profileSettings.layoutModern', layoutCss: modernCss, palette: DEFAULT_PALETTE },
  irc: { nameKey: 'profileSettings.layoutIrc', layoutCss: ircCss, palette: { light: IRC_LIGHT_COLORS, dark: IRC_DARK_COLORS } },
};

/** Layout-only CSS of the builtin themes (the .css files), without the palette. */
export const BUILTIN_LAYOUT_CSS = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([id, { layoutCss }]) => [id, layoutCss]),
) as Record<BuiltinThemeId, string>;

/** The message-color palette each builtin theme ships with (the Creator's starting colors). */
export const BUILTIN_PALETTES = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([id, { palette }]) => [id, palette]),
) as Record<BuiltinThemeId, BuiltinThemeDefinition['palette']>;

// A builtin theme's CSS = layout rules + its message-color palette, so the CSS
// editor shows the --msg-* colors ready to tweak (the same values the Theme
// Creator's pickers edit). The palette comes last, so it wins over any --msg-*
// the layout CSS sets on :root / .dark.
export const BUILTIN_THEMES = Object.fromEntries(
  Object.entries(DEFINITIONS).map(([id, { nameKey, layoutCss, palette }]) => [
    id,
    { nameKey, css: `${layoutCss.trimEnd()}\n\n${buildPaletteCss(palette.light, palette.dark)}\n` },
  ]),
) as Record<BuiltinThemeId, { nameKey: string; css: string }>;

export const BUILTIN_THEME_IDS = Object.keys(DEFINITIONS) as BuiltinThemeId[];

export const isBuiltinTheme = (id: string): id is BuiltinThemeId => Object.hasOwn(DEFINITIONS, id);
