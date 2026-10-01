import { useEffect } from 'react';

export const PREVIEW_STYLE_ID = 'sic-theme-preview';

// A second <style> after the active theme's, so the draft wins while typing
export const useThemePreview = (css: string, enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) { return; }
    const handle = setTimeout(() => {
      let el = document.getElementById(PREVIEW_STYLE_ID) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = PREVIEW_STYLE_ID;
      }
      document.head.appendChild(el);
      el.textContent = css;
    }, 300);
    return () => clearTimeout(handle);
  }, [css, enabled]);

  useEffect(() => () => {
    document.getElementById(PREVIEW_STYLE_ID)?.remove();
  }, []);
};
