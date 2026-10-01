// Mobile only; the plugin is imported dynamically so it only loads on mobile
import { isMobile } from './desktop';

let permissionGranted = false;

/** At startup: permission can't be requested from the background. */
export const initMobileNotifications = async (): Promise<void> => {
  if (!isMobile()) {
    return;
  }
  try {
    const { isPermissionGranted, requestPermission } = await import(
      '@tauri-apps/plugin-notification'
    );
    permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === 'granted';
    }
  } catch (err) {
    console.warn('[notifications] init failed:', err);
  }
};

export const notifyHighlight = async (params: {
  nick: string;
  target: string;
  message: string;
  /** DM rather than a channel mention */
  isDirect: boolean;
}): Promise<void> => {
  if (!isMobile() || !permissionGranted) {
    return;
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    // DM title: the nick; channel mention: "<nick> • <#channel>"
    sendNotification({
      title: params.isDirect ? params.nick : `${params.nick} • ${params.target}`,
      body: params.message,
    });
  } catch (err) {
    console.warn('[notifications] send failed:', err);
  }
};
