import { describe, expect, it, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { BUILTIN_THEMES } from '../builtinThemes';
import ThemeStyleInjector, { THEME_STYLE_ID } from '../components/ThemeStyleInjector';

describe('ThemeStyleInjector', () => {
  beforeEach(() => {
    document.getElementById(THEME_STYLE_ID)?.remove();
    useSettingsStore.setState({ theme: 'modern', customThemes: {}, builtinThemeOverrides: {} });
  });

  it('should inject the active theme CSS into a <style id="sic-theme"> tag', () => {
    render(<ThemeStyleInjector />);

    const el = document.getElementById(THEME_STYLE_ID);
    expect(el?.tagName).toBe('STYLE');
    expect(el?.textContent).toBe(BUILTIN_THEMES.modern.css);
  });

  it('should update the CSS when the theme changes', () => {
    render(<ThemeStyleInjector />);

    act(() => {
      useSettingsStore.getState().setTheme('classic');
    });

    expect(document.getElementById(THEME_STYLE_ID)?.textContent).toBe(BUILTIN_THEMES.classic.css);
  });

  it('should apply builtin overrides and custom themes', () => {
    render(<ThemeStyleInjector />);

    act(() => {
      useSettingsStore.getState().setBuiltinThemeCss('modern', '.override {}');
    });
    expect(document.getElementById(THEME_STYLE_ID)?.textContent).toBe('.override {}');

    act(() => {
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.neon {}');
      useSettingsStore.getState().setTheme(id);
    });
    expect(document.getElementById(THEME_STYLE_ID)?.textContent).toBe('.neon {}');
  });

  it('should keep the style tag last in <head> so theme rules win ties', () => {
    render(<ThemeStyleInjector />);

    const later = document.createElement('style');
    document.head.appendChild(later);

    act(() => {
      useSettingsStore.getState().setTheme('classic');
    });

    expect(document.head.lastElementChild?.id).toBe(THEME_STYLE_ID);
    later.remove();
  });
});
