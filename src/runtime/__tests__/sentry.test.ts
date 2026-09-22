import { describe, it, expect, beforeEach, vi } from 'vitest';

const sentryInitMock = vi.fn();
const sentrySetTagMock = vi.fn();
const getAppVersionMock = vi.fn();
const isDesktopMock = vi.fn();
const isMobileMock = vi.fn();

vi.mock('@sentry/react', () => ({
  init: (options: unknown) => sentryInitMock(options),
  setTag: (key: string, value: string) => sentrySetTagMock(key, value),
  browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
}));

vi.mock('../desktop', () => ({
  getAppVersion: () => getAppVersionMock(),
  isDesktop: () => isDesktopMock(),
  isMobile: () => isMobileMock(),
}));

vi.stubGlobal('__GIT_REF__', 'abc1234');

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('runtime/sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    sentryInitMock.mockReset();
    sentrySetTagMock.mockReset();
    getAppVersionMock.mockReset();
    isDesktopMock.mockReset().mockReturnValue(false);
    isMobileMock.mockReset().mockReturnValue(false);
  });

  it('sets the release to the git ref and tags the web runtime', async () => {
    getAppVersionMock.mockResolvedValue(null);
    const { initSentry } = await import('../sentry');
    initSentry();
    await flush();

    expect(sentryInitMock).toHaveBeenCalledWith(expect.objectContaining({
      release: 'simple-irc-client@abc1234',
      initialScope: { tags: { runtime: 'web' } },
    }));
    expect(sentrySetTagMock).not.toHaveBeenCalled();
  });

  it('tags the desktop runtime and the Tauri app version', async () => {
    isDesktopMock.mockReturnValue(true);
    getAppVersionMock.mockResolvedValue('2.0.9');
    const { initSentry } = await import('../sentry');
    initSentry();
    await flush();

    expect(sentryInitMock).toHaveBeenCalledWith(expect.objectContaining({
      initialScope: { tags: { runtime: 'desktop' } },
    }));
    expect(sentrySetTagMock).toHaveBeenCalledWith('app.version', '2.0.9');
  });

  it('tags the mobile runtime', async () => {
    isDesktopMock.mockReturnValue(true);
    isMobileMock.mockReturnValue(true);
    getAppVersionMock.mockResolvedValue('2.0.9');
    const { initSentry } = await import('../sentry');
    initSentry();

    expect(sentryInitMock).toHaveBeenCalledWith(expect.objectContaining({
      initialScope: { tags: { runtime: 'mobile' } },
    }));
  });
});
