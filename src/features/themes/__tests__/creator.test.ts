import { describe, expect, it } from 'vitest';
import { BUILTIN_LAYOUT_CSS, BUILTIN_PALETTES, BUILTIN_THEME_IDS } from '../builtinThemes';
import {
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  changeCreatorBase,
  defaultCreatorSettings,
  generateThemeCss,
  parseCreatorSettings,
} from '../creator';

describe('generateThemeCss', () => {
  it('should include the base layout CSS exactly once, with a single palette', () => {
    for (const base of BUILTIN_THEME_IDS) {
      const css = generateThemeCss(defaultCreatorSettings(base));
      expect(css).toContain(BUILTIN_LAYOUT_CSS[base].trimEnd());
      // The palette comes only from the Creator settings, not from the base
      expect(css.match(/--msg-join:/g)).toHaveLength(2); // :root + .dark
    }
  });

  it('should emit the light palette on :root and the dark palette on .dark', () => {
    const settings = defaultCreatorSettings();
    settings.colors.light.join = '#123456';
    settings.colors.dark.join = '#654321';

    const css = generateThemeCss(settings);

    expect(css).toMatch(/:root \{[^}]*--msg-join: #123456;/);
    expect(css).toMatch(/\.dark \{[^}]*--msg-join: #654321;/);
    expect(css).toMatch(/:root \{[^}]*--msg-time: #666666;/);
  });

  it('should apply the layout toggles', () => {
    const settings = defaultCreatorSettings('modern');
    settings.showSeconds = true;
    settings.showAvatars = false;
    settings.showEmbeds = false;
    settings.compact = true;

    const css = generateThemeCss(settings);

    expect(css).toContain('.sic-msg-time-seconds { display: inline; }');
    expect(css).toContain('.sic-msg-gutter { display: none; }');
    expect(css).toContain('.sic-msg-embeds { display: none; }');
    expect(css).toContain('padding-top: 0; padding-bottom: 0;');
  });

  it.each(['classic', 'irc'] as const)('should not hide the gutter for the %s base (already hidden there)', (base) => {
    const settings = defaultCreatorSettings(base);
    settings.showAvatars = false;

    const css = generateThemeCss(settings);

    expect(css).not.toContain('.sic-msg-gutter { display: none; }');
  });
});

describe('parseCreatorSettings', () => {
  it('should round-trip settings through the generated CSS', () => {
    const settings = defaultCreatorSettings('classic');
    settings.showSeconds = true;
    settings.colors.dark.error = '#ff00ff';

    const parsed = parseCreatorSettings(generateThemeCss(settings));

    expect(parsed).toEqual(settings);
  });

  it('should return null for hand-written CSS', () => {
    expect(parseCreatorSettings('.sic-msg { color: red; }')).toBeNull();
    expect(parseCreatorSettings('')).toBeNull();
  });

  it('should return null for a corrupted marker', () => {
    expect(parseCreatorSettings('/* sic-creator:1 {not json} */')).toBeNull();
    expect(parseCreatorSettings('/* sic-creator:1 {"base":"nope"} */')).toBeNull();
  });

  it('should ship complete default palettes', () => {
    const settings = defaultCreatorSettings();
    expect(Object.keys(settings.colors.light)).toEqual(Object.keys(DEFAULT_LIGHT_COLORS));
    expect(Object.keys(settings.colors.dark)).toEqual(Object.keys(DEFAULT_DARK_COLORS));
  });
});

describe('defaultCreatorSettings', () => {
  it.each(BUILTIN_THEME_IDS)('should start the %s base from that theme\'s own palette', (base) => {
    const settings = defaultCreatorSettings(base);
    expect(settings.colors).toEqual(BUILTIN_PALETTES[base]);
    // A copy — editing the Creator's colors must not mutate the shipped palette
    expect(settings.colors.light).not.toBe(BUILTIN_PALETTES[base].light);
    expect(settings.colors.dark).not.toBe(BUILTIN_PALETTES[base].dark);
  });
});

describe('changeCreatorBase', () => {
  it('should switch untouched colors to the new base palette', () => {
    const next = changeCreatorBase(defaultCreatorSettings('modern'), 'irc');

    expect(next.base).toBe('irc');
    expect(next.colors).toEqual(BUILTIN_PALETTES.irc);
  });

  it('should keep colors the user customised', () => {
    const settings = defaultCreatorSettings('modern');
    settings.colors.dark.join = '#010203';

    const next = changeCreatorBase(settings, 'irc');

    expect(next.base).toBe('irc');
    expect(next.colors).toBe(settings.colors);
  });

  it('should keep the other options', () => {
    const settings = { ...defaultCreatorSettings('irc'), showSeconds: true, compact: true, showEmbeds: false };

    const next = changeCreatorBase(settings, 'classic');

    expect(next).toMatchObject({ base: 'classic', showSeconds: true, compact: true, showEmbeds: false });
    expect(next.colors).toEqual(BUILTIN_PALETTES.classic);
  });

  it('should keep the palette when switching between bases that share it', () => {
    const settings = defaultCreatorSettings('classic');

    expect(changeCreatorBase(settings, 'modern').colors).toEqual(BUILTIN_PALETTES.modern);
  });
});

describe('parseCreatorSettings with the irc base', () => {
  it('should round-trip an irc-based theme', () => {
    const settings = defaultCreatorSettings('irc');
    settings.colors.light.me = '#123123';

    expect(parseCreatorSettings(generateThemeCss(settings))).toEqual(settings);
  });

  it('should reject a base that is only an Object.prototype key', () => {
    const settings = { ...defaultCreatorSettings('irc'), base: 'toString' };
    expect(parseCreatorSettings(`/* sic-creator:1 ${JSON.stringify(settings)} */`)).toBeNull();
  });
});
