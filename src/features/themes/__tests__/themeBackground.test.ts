import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DARK_BACKGROUND_LUMINANCE, LIGHT_BACKGROUND_LUMINANCE } from '@shared/lib/utils';
import { measureThemeBackgroundLuminance, useThemeBackgroundStore, watchThemeBackground } from '../themeBackground';

const STYLE_ID = 'theme-background-test';

const setThemeCss = (css: string): void => {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
};

// MutationObserver callbacks run as microtasks
const flush = () => new Promise<void>((resolve) => { queueMicrotask(resolve); });

describe('themeBackground', () => {
  beforeEach(() => {
    useThemeBackgroundStore.setState({ luminance: LIGHT_BACKGROUND_LUMINANCE });
  });

  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.classList.remove('dark');
  });

  it('should measure the background the theme paints on <body>', () => {
    setThemeCss('body { background-color: #141311; }');
    expect(measureThemeBackgroundLuminance()).toBeCloseTo(0.0065, 3);
  });

  it('should fall back to the light/dark extreme when nothing is painted', () => {
    expect(measureThemeBackgroundLuminance()).toBe(LIGHT_BACKGROUND_LUMINANCE);
    document.documentElement.classList.add('dark');
    expect(measureThemeBackgroundLuminance()).toBe(DARK_BACKGROUND_LUMINANCE);
  });

  it('should update the store when theme CSS or the dark class changes', async () => {
    const stop = watchThemeBackground();
    expect(useThemeBackgroundStore.getState().luminance).toBe(LIGHT_BACKGROUND_LUMINANCE);

    setThemeCss('body { background-color: #ffffff; } .dark body { background-color: #000000; }');
    await flush();
    expect(useThemeBackgroundStore.getState().luminance).toBe(1);

    document.documentElement.classList.add('dark');
    await flush();
    expect(useThemeBackgroundStore.getState().luminance).toBe(0);

    stop();
    document.documentElement.classList.remove('dark');
    await flush();
    expect(useThemeBackgroundStore.getState().luminance).toBe(0);
  });
});
