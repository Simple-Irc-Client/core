/**
 * The message-color palette: single source of truth for the `--msg-*` values
 * shipped with the builtin themes and shown in the Theme Creator's pickers.
 * Keep in sync with the fallback values on :root / .dark in src/index.css.
 */

export const MSG_COLOR_KEYS = [
  'time',
  'default',
  'body',
  'join',
  'part',
  'quit',
  'kick',
  'mode',
  'notice',
  'info',
  'me',
  'error',
] as const;

export type MsgColorKey = (typeof MSG_COLOR_KEYS)[number];

export type MsgColorPalette = Record<MsgColorKey, string>;

export const DEFAULT_LIGHT_COLORS: MsgColorPalette = {
  time: '#666666',
  default: '#000000',
  body: '#3a3a47',
  join: '#009300',
  part: '#4733ff',
  quit: '#00007f',
  kick: '#00007f',
  mode: '#009300',
  notice: '#0066ff',
  info: '#666666',
  me: '#800080',
  error: '#ff0000',
};

export const DEFAULT_DARK_COLORS: MsgColorPalette = {
  time: '#444466',
  default: '#b8b8d0',
  body: '#b8b8d0',
  join: '#5a8a5a',
  part: '#7a6a8a',
  quit: '#6a6a8a',
  kick: '#8a5a5a',
  mode: '#6a8a6a',
  notice: '#6e9ecf',
  info: '#55557a',
  me: '#c47ea0',
  error: '#b05555',
};

const paletteToCss = (selector: string, palette: MsgColorPalette): string => {
  const lines = MSG_COLOR_KEYS.map((key) => `  --msg-${key}: ${palette[key]};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
};

/** The two palette blocks (light on :root, dark on .dark) appended to theme CSS. */
export const buildPaletteCss = (light: MsgColorPalette, dark: MsgColorPalette): string =>
  [
    '/* Message colors — light mode */',
    paletteToCss(':root', light),
    '',
    '/* Message colors — dark mode */',
    paletteToCss('.dark', dark),
  ].join('\n');
