import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn<() => Promise<boolean>>(),
  requestPermission: vi.fn<() => Promise<string>>(),
  sendNotification: vi.fn(),
}));
const desktop = vi.hoisted(() => ({ isMobile: vi.fn(() => true) }));

vi.mock('@tauri-apps/plugin-notification', () => plugin);
vi.mock('../desktop', () => desktop);

const highlight = { nick: 'alice', target: '#sic', message: 'hi there', isDirect: false };

/** A fresh module: the granted permission is kept per app run */
const load = async () => {
  vi.resetModules();
  return import('../notifications');
};

const setVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

describe('mobile notifications', () => {
  beforeEach(() => {
    desktop.isMobile.mockReturnValue(true);
    plugin.isPermissionGranted.mockResolvedValue(true);
    plugin.requestPermission.mockResolvedValue('granted');
    setVisibility('hidden');
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    setVisibility('visible');
  });

  it('should notify a channel mention as "nick • channel", and a DM by the nick alone', async () => {
    const { initMobileNotifications, notifyHighlight } = await load();
    await initMobileNotifications();

    await notifyHighlight(highlight);
    await notifyHighlight({ ...highlight, target: 'alice', isDirect: true });

    expect(plugin.sendNotification.mock.calls).toEqual([
      [{ title: 'alice • #sic', body: 'hi there' }],
      [{ title: 'alice', body: 'hi there' }],
    ]);
  });

  it('should ask for permission at startup when not granted yet, and notify once it is', async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    const { initMobileNotifications, notifyHighlight } = await load();

    await initMobileNotifications();
    await notifyHighlight(highlight);

    expect(plugin.requestPermission).toHaveBeenCalledOnce();
    expect(plugin.sendNotification).toHaveBeenCalledOnce();
  });

  it('should not notify when permission is refused', async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue('denied');
    const { initMobileNotifications, notifyHighlight } = await load();

    await initMobileNotifications();
    await notifyHighlight(highlight);

    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('should not notify while the app is on screen', async () => {
    const { initMobileNotifications, notifyHighlight } = await load();
    await initMobileNotifications();
    setVisibility('visible');

    await notifyHighlight(highlight);

    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('should do nothing off mobile, without loading the plugin', async () => {
    desktop.isMobile.mockReturnValue(false);
    const { initMobileNotifications, notifyHighlight } = await load();

    await initMobileNotifications();
    await notifyHighlight(highlight);

    expect(plugin.isPermissionGranted).not.toHaveBeenCalled();
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('should carry on without notifications when the plugin fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    plugin.isPermissionGranted.mockRejectedValue(new Error('no plugin'));
    const { initMobileNotifications, notifyHighlight } = await load();

    await expect(initMobileNotifications()).resolves.toBeUndefined();
    await notifyHighlight(highlight);

    expect(plugin.sendNotification).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[notifications] init failed:', expect.any(Error));
  });

  it('should report a notification that could not be sent, without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    plugin.sendNotification.mockImplementation(() => {
      throw new Error('send failed');
    });
    const { initMobileNotifications, notifyHighlight } = await load();
    await initMobileNotifications();

    await expect(notifyHighlight(highlight)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[notifications] send failed:', expect.any(Error));
  });
});
