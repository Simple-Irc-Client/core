/**
 * Runtime adapter for desktop-only platform APIs.
 *
 * In Tauri builds, dispatches to Tauri plugin commands. In browser builds
 * (website), falls through to standard web APIs so the same source compiles
 * to both targets without conditional bundling.
 */
import {
  readText as tauriReadText,
  writeText as tauriWriteText,
} from '@tauri-apps/plugin-clipboard-manager';
import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener';

/**
 * True when the renderer is running inside a Tauri webview.
 *
 * Tauri injects `__TAURI_INTERNALS__` on `window` before any user JS runs,
 * so the check is synchronous and safe at module top-level.
 */
export const isDesktop = (): boolean => {
  return (
    typeof globalThis !== 'undefined' &&
    '__TAURI_INTERNALS__' in globalThis
  );
};

export const clipboard = {
  readText: async (): Promise<string> => {
    if (isDesktop()) {
      return tauriReadText();
    }
    return navigator.clipboard.readText();
  },
  writeText: async (text: string): Promise<void> => {
    if (isDesktop()) {
      return tauriWriteText(text);
    }
    return navigator.clipboard.writeText(text);
  },
};

/**
 * Open `url` in the OS default browser. In a regular browser context this
 * just calls `window.open` with `_blank`. In Tauri the webview can't follow
 * links to a separate process — the opener plugin shells out instead.
 *
 * Pre-validate URLs upstream (e.g. with `isSafeUrl`); the Tauri capability
 * already restricts the allowed URL schemes, but defence in depth doesn't hurt.
 */
export const openExternal = async (url: string): Promise<void> => {
  if (isDesktop()) {
    await tauriOpenUrl(url);
    return;
  }
  globalThis.open(url, '_blank', 'noopener,noreferrer');
};
