import { describe, expect, it } from 'vitest';
import { BUILTIN_LAYOUT_CSS } from '../builtinThemes';
import {
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  defaultCreatorSettings,
  generateThemeCss,
  parseCreatorSettings,
} from '../creator';

describe('generateThemeCss', () => {
  it('should include the base layout CSS exactly once, with a single palette', () => {
    for (const base of ['classic', 'modern'] as const) {
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

  it('should not hide the gutter for the classic base (already hidden there)', () => {
    const settings = defaultCreatorSettings('classic');
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
