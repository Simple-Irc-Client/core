import { useEffect } from 'react';

export const PREVIEW_STYLE_ID = 'sic-theme-preview';

/**
 * Live preview for theme editing: debounce-writes the draft CSS into a second
 * <style> appended after the active theme's tag (so it wins while typing) and
 * removes it when the editing dialog unmounts.
 */
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

  // Remove the preview on close/cancel, whatever the outcome
  useEffect(() => () => {
    document.getElementById(PREVIEW_STYLE_ID)?.remove();
  }, []);
};
