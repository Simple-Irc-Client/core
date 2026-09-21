import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const registerMock = vi.fn();
const getRegistrationsMock = vi.fn();

const stubServiceWorker = () => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: registerMock, getRegistrations: getRegistrationsMock },
  });
};

describe('runtime/serviceWorker', () => {
  beforeEach(() => {
    registerMock.mockReset().mockResolvedValue({});
    getRegistrationsMock.mockReset().mockResolvedValue([]);
    stubServiceWorker();
    vi.stubEnv('PROD', true);
    vi.stubGlobal('location', { protocol: 'https:' });
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    // @ts-expect-error — remove the stub so other tests see a clean navigator
    delete navigator.serviceWorker;
  });

  it('registers on the website over https', async () => {
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(registerMock).toHaveBeenCalledWith('./sw.js', { scope: './' });
  });

  it('waits for the window load event before registering', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const { initServiceWorker } = await import('../serviceWorker');
    const pending = initServiceWorker();
    await Promise.resolve();
    expect(registerMock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    await pending;
    expect(registerMock).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('registers over http (e.g. self-hosted behind localhost)', async () => {
    vi.stubGlobal('location', { protocol: 'http:' });
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('never registers under tauri:// (the reported Safari/WebKitGTK crash)', async () => {
    vi.stubGlobal('location', { protocol: 'tauri:' });
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('never registers under file://', async () => {
    vi.stubGlobal('location', { protocol: 'file:' });
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('never registers in dev builds', async () => {
    vi.stubEnv('PROD', false);
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('does not register inside Tauri even on an http(s) origin (Windows/Android)', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.stubGlobal('location', { protocol: 'http:' });
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('unregisters workers left behind by older builds inside Tauri', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const unregister = vi.fn().mockResolvedValue(true);
    getRegistrationsMock.mockResolvedValue([{ unregister }, { unregister }]);
    const { initServiceWorker } = await import('../serviceWorker');
    await initServiceWorker();
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('swallows getRegistrations failures inside Tauri', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    getRegistrationsMock.mockRejectedValue(new Error('SecurityError'));
    const { initServiceWorker } = await import('../serviceWorker');
    await expect(initServiceWorker()).resolves.toBeUndefined();
  });

  it('is a no-op when the browser has no service worker support', async () => {
    // @ts-expect-error — simulate an engine without the API
    delete navigator.serviceWorker;
    const { initServiceWorker } = await import('../serviceWorker');
    await expect(initServiceWorker()).resolves.toBeUndefined();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('does not throw when registration itself fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerMock.mockRejectedValue(new Error('boom'));
    const { initServiceWorker } = await import('../serviceWorker');
    await expect(initServiceWorker()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
