import { create } from 'zustand';
import { cssColorToRgb, DARK_BACKGROUND_LUMINANCE, LIGHT_BACKGROUND_LUMINANCE, relativeLuminance } from '@shared/lib/utils';

// Luminance of the background the active theme paints, to keep sender-chosen colors readable on it
interface ThemeBackgroundState {
  luminance: number;
}

export const useThemeBackgroundStore = create<ThemeBackgroundState>(() => ({
  luminance: LIGHT_BACKGROUND_LUMINANCE,
}));

export const measureThemeBackgroundLuminance = (): number => {
  const rgb = cssColorToRgb(getComputedStyle(document.body).backgroundColor);
  if (rgb) { return relativeLuminance(...rgb); }
  return document.documentElement.classList.contains('dark') ? DARK_BACKGROUND_LUMINANCE : LIGHT_BACKGROUND_LUMINANCE;
};

const update = (): void => {
  const luminance = measureThemeBackgroundLuminance();
  if (useThemeBackgroundStore.getState().luminance !== luminance) {
    useThemeBackgroundStore.setState({ luminance });
  }
};

// Observes the DOM (theme/preview <style>s, the .dark class) rather than settings, so it measures after they apply
export const watchThemeBackground = (): (() => void) => {
  update();
  const observer = new MutationObserver(update);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  return () => observer.disconnect();
};
