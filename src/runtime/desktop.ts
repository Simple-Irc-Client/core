// Tauri plugin calls in Tauri builds, web APIs on the website, from the same source
import {
  readText as tauriReadText,
  writeText as tauriWriteText,
} from '@tauri-apps/plugin-clipboard-manager';
import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener';
import { check as tauriCheckUpdate } from '@tauri-apps/plugin-updater';
import { getVersion as tauriGetVersion } from '@tauri-apps/api/app';

/** Any Tauri webview, mobile included. Safe at module top level: injected before user JS. */
export const isDesktop = (): boolean => {
  return (
    typeof globalThis !== 'undefined' &&
    '__TAURI_INTERNALS__' in globalThis
  );
};

/** Tauri on Android/iOS; gates desktop-only features like the updater. */
export const isMobile = (): boolean => {
  if (!isDesktop()) {
    return false;
  }
  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /android|iphone|ipad|ipod/i.test(ua);
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

/** Validate upstream (e.g. isSafeUrl). */
export const openExternal = async (url: string): Promise<void> => {
  if (isDesktop()) {
    await tauriOpenUrl(url);
    return;
  }
  globalThis.open(url, '_blank', 'noopener,noreferrer');
};

/** Null on the website or on failure: diagnostics only, must never break startup. */
export const getAppVersion = async (): Promise<string | null> => {
  if (!isDesktop()) {
    return null;
  }
  try {
    return await tauriGetVersion();
  } catch (err) {
    console.warn('[app] version lookup failed:', err);
    return null;
  }
};

/** Failures are logged and swallowed: must never block startup. */
export const checkForUpdates = async (): Promise<void> => {
  // Mobile updates ship via the app store; the updater plugin isn't registered there
  if (!isDesktop() || isMobile()) {
    return;
  }
  try {
    const update = await tauriCheckUpdate();
    if (!update) {
      return;
    }
    const ok = globalThis.confirm(
      `Version ${update.version} is available. Install now?`,
    );
    if (!ok) {
      return;
    }
    await update.downloadAndInstall();
  } catch (err) {
    console.warn('[updater] check failed:', err);
  }
};
