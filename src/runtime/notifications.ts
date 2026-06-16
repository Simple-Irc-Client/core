/**
 * Mobile highlight notifications.
 *
 * Posts an OS notification when a mention / private message arrives while the
 * app isn't in the foreground — the defining "mobile IRC" affordance. Inert on
 * web and desktop:
 *  - gated behind `isMobile()`, so the website and desktop builds never call it;
 *  - the `@tauri-apps/plugin-notification` module is imported dynamically, so it
 *    is code-split into a chunk that only loads on mobile.
 *
 * The desktop/web notification story is intentionally unchanged.
 */
import { isMobile } from './desktop';

let permissionGranted = false;

/**
 * Request notification permission once, at startup, while the app is in the
 * foreground (you can't prompt from the background). No-op off mobile.
 */
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

/**
 * Post a notification for an incoming highlight. Only fires when the app is not
 * currently visible — we never interrupt a user already looking at the chat.
 */
export const notifyHighlight = async (params: {
  nick: string;
  target: string;
  message: string;
  /** True for a direct private message (DM) to your nick, false for a channel mention. */
  isDirect: boolean;
}): Promise<void> => {
  if (!isMobile() || !permissionGranted) {
    return;
  }
  // Don't notify while the user is actively viewing the app.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    // DM: the sender is the conversation, so the nick alone is the clearest
    // title. Channel mention: show "<nick> • <#channel>".
    sendNotification({
      title: params.isDirect ? params.nick : `${params.nick} • ${params.target}`,
      body: params.message,
    });
  } catch (err) {
    console.warn('[notifications] send failed:', err);
  }
};
