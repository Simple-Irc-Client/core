import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import * as Sentry from '@sentry/react';
import { checkForUpdates, isDesktop } from './runtime/desktop';
import { initMobileNotifications } from './runtime/notifications';

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'],
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});

console.log(`Simple IRC Client [${__GIT_REF__}]`);

// In Tauri builds the service worker is unwanted: WKWebView ignores it,
// WebKitGTK and WebView2 happily cache stale bundles under tauri://localhost
// and prevent the auto-updater's new bundle from being seen. Strip any
// previously-registered worker before render. The website path keeps the SW.
if (isDesktop() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => { void r.unregister(); }))
    .catch(() => { /* ignore — best effort */ });
}

// Fire-and-forget update check on desktop builds. No-op in the website.
void checkForUpdates();

// Request notification permission on mobile (no-op on web/desktop).
void initMobileNotifications();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// TEMPORARY — see src/UiProbeSubmenuPage.tsx. Only true when the Tauri shell
// was launched with UI_PROBE_TEST=1 (the dedicated CI workflow); never in a
// normal build, so this never reaches real users. Remove alongside that file.
const renderApp = async (): Promise<void> => {
  if (isDesktop()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const probing = await invoke<boolean>('get_ui_probe_mode').catch(() => false);
    if (probing) {
      const { default: UiProbeSubmenuPage } = await import('./UiProbeSubmenuPage');
      root.render(<UiProbeSubmenuPage />);
      return;
    }
  }
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

void renderApp();
