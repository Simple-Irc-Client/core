import { isDesktop } from './desktop';

/**
 * Owns the service worker lifecycle for every build target.
 *
 * The same `dist` ships to the website and to Tauri, so registration has to be
 * decided at runtime — vite-plugin-pwa's injected `registerSW.js` registers
 * unconditionally, which throws on `tauri://localhost` (macOS/Linux webviews)
 * because `serviceWorker.register()` only accepts http(s) script URLs.
 *
 * - Website (http/https): register `sw.js`. The worker generated with
 *   `registerType: 'autoUpdate'` activates itself (skipWaiting + clientsClaim).
 * - Tauri: never register, and strip any worker registered by an older build.
 *   WKWebView ignores workers, while WebKitGTK and WebView2 cache stale bundles
 *   and prevent the auto-updater's new bundle from being seen.
 * - Anything else (file://, dev server): do nothing.
 */
export const initServiceWorker = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (isDesktop()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      // Best effort — a stale worker is harmless compared to failing startup.
    }
    return;
  }

  if (!import.meta.env.PROD || !/^https?:$/.test(location.protocol)) {
    return;
  }

  try {
    if (document.readyState !== 'complete') {
      await new Promise<void>((resolve) => {
        window.addEventListener('load', () => resolve(), { once: true });
      });
    }
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
};
