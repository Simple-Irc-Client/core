import { useEffect } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { getActiveThemeCss } from '../themeSelectors';

export const THEME_STYLE_ID = 'sic-theme';

/**
 * Injects the active theme's CSS into <head>. The <style> tag is re-appended on
 * every change so it always sits after the Vite-injected app stylesheet and wins
 * ties at equal specificity (e.g. `:root { --msg-time: ... }` overrides).
 */
const ThemeStyleInjector = () => {
  const css = useSettingsStore(getActiveThemeCss);

  useEffect(() => {
    let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = THEME_STYLE_ID;
    }
    document.head.appendChild(el);
    el.textContent = css;
  }, [css]);

  return null;
};

export default ThemeStyleInjector;
