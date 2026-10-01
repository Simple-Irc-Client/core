import { isDesktop } from './desktop';

/**
 * Decided at runtime since the same dist ships everywhere (register() throws on tauri://). Website: register
 * sw.js. Tauri: unregister old workers, which cache stale bundles and hide updates. Otherwise: nothing.
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
      // A stale worker beats failing startup
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
