import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const tauriClipboardReadMock = vi.fn();
const tauriClipboardWriteMock = vi.fn();
const tauriOpenUrlMock = vi.fn();

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: () => tauriClipboardReadMock(),
  writeText: (text: string) => tauriClipboardWriteMock(text),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: (url: string) => tauriOpenUrlMock(url),
}));

describe('runtime/desktop', () => {
  beforeEach(() => {
    tauriClipboardReadMock.mockReset();
    tauriClipboardWriteMock.mockReset();
    tauriOpenUrlMock.mockReset();
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('isDesktop is false when __TAURI_INTERNALS__ is absent', async () => {
    const { isDesktop } = await import('../desktop');
    expect(isDesktop()).toBe(false);
  });

  it('isDesktop is true when __TAURI_INTERNALS__ is present', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const { isDesktop } = await import('../desktop');
    expect(isDesktop()).toBe(true);
  });

  const setUserAgent = (ua: string): void => {
    Object.defineProperty(navigator, 'userAgent', {
      value: ua,
      configurable: true,
    });
  };

  it('isMobile is false outside a Tauri webview', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36');
    const { isMobile } = await import('../desktop');
    expect(isMobile()).toBe(false);
  });

  it('isMobile is true in a Tauri webview with a mobile user agent', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36');
    const { isMobile } = await import('../desktop');
    expect(isMobile()).toBe(true);
  });

  it('isMobile is false in a Tauri webview on desktop', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
    const { isMobile } = await import('../desktop');
    expect(isMobile()).toBe(false);
  });

  it('clipboard.readText routes to navigator in browser mode', async () => {
    const navReadText = vi.fn().mockResolvedValue('from-nav');
    Object.assign(navigator, {
      clipboard: { readText: navReadText, writeText: vi.fn() },
    });
    const { clipboard } = await import('../desktop');
    await expect(clipboard.readText()).resolves.toBe('from-nav');
    expect(navReadText).toHaveBeenCalledOnce();
    expect(tauriClipboardReadMock).not.toHaveBeenCalled();
  });

  it('clipboard.readText routes to Tauri plugin in desktop mode', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    tauriClipboardReadMock.mockResolvedValue('from-tauri');
    const navReadText = vi.fn();
    Object.assign(navigator, {
      clipboard: { readText: navReadText, writeText: vi.fn() },
    });
    const { clipboard } = await import('../desktop');
    await expect(clipboard.readText()).resolves.toBe('from-tauri');
    expect(tauriClipboardReadMock).toHaveBeenCalledOnce();
    expect(navReadText).not.toHaveBeenCalled();
  });

  it('clipboard.writeText routes to Tauri plugin in desktop mode', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    tauriClipboardWriteMock.mockResolvedValue(undefined);
    const navWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: { readText: vi.fn(), writeText: navWriteText },
    });
    const { clipboard } = await import('../desktop');
    await clipboard.writeText('hello');
    expect(tauriClipboardWriteMock).toHaveBeenCalledWith('hello');
    expect(navWriteText).not.toHaveBeenCalled();
  });

  it('openExternal calls window.open in browser mode', async () => {
    const openSpy = vi.spyOn(globalThis, 'open').mockReturnValue(null);
    const { openExternal } = await import('../desktop');
    await openExternal('https://example.com');
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    );
    expect(tauriOpenUrlMock).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('openExternal calls Tauri opener in desktop mode', async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    tauriOpenUrlMock.mockResolvedValue(undefined);
    const openSpy = vi.spyOn(globalThis, 'open').mockReturnValue(null);
    const { openExternal } = await import('../desktop');
    await openExternal('https://example.com');
    expect(tauriOpenUrlMock).toHaveBeenCalledWith('https://example.com');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
