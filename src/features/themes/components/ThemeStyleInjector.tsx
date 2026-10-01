import { useEffect } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { getActiveThemeCss } from '../themeSelectors';
import { watchThemeBackground } from '../themeBackground';

export const THEME_STYLE_ID = 'sic-theme';

// Re-appended on every change so it stays after the app stylesheet and wins specificity ties
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

  useEffect(() => watchThemeBackground(), []);

  return null;
};

export default ThemeStyleInjector;
