import { create } from 'zustand';
import { cssColorToRgb, DARK_BACKGROUND_LUMINANCE, LIGHT_BACKGROUND_LUMINANCE, relativeLuminance } from '@shared/lib/utils';

/**
 * The relative luminance of the background the active theme actually paints,
 * so sender-chosen colors (nick colors, mIRC colors) can be kept readable
 * against it rather than against an assumed white/black. Themes may set any
 * `--background` (the IRC theme's paper, a user's grey), in any color syntax.
 */
interface ThemeBackgroundState {
  luminance: number;
}

export const useThemeBackgroundStore = create<ThemeBackgroundState>(() => ({
  luminance: LIGHT_BACKGROUND_LUMINANCE,
}));

export const measureThemeBackgroundLuminance = (): number => {
  const rgb = cssColorToRgb(getComputedStyle(document.body).backgroundColor);
  if (rgb) { return relativeLuminance(...rgb); }
  // Unmeasurable (e.g. no stylesheet applied yet): assume the mode's extreme
  return document.documentElement.classList.contains('dark') ? DARK_BACKGROUND_LUMINANCE : LIGHT_BACKGROUND_LUMINANCE;
};

const update = (): void => {
  const luminance = measureThemeBackgroundLuminance();
  if (useThemeBackgroundStore.getState().luminance !== luminance) {
    useThemeBackgroundStore.setState({ luminance });
  }
};

/**
 * Keeps the store in sync with whatever changes the background: the injected
 * theme <style>, the Theme editor's live preview <style>, Vite's dev styles
 * (all in <head>), and the `.dark` class on <html>. Observing the DOM rather
 * than the settings store makes the measurement independent of the order in
 * which those effects run. Returns the disconnect function.
 */
export const watchThemeBackground = (): (() => void) => {
  update();
  const observer = new MutationObserver(update);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  return () => observer.disconnect();
};
