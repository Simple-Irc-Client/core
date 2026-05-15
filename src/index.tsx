import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import '@fontsource-variable/inter';
import './index.css';
import * as Sentry from '@sentry/react';
import { checkForUpdates, isDesktop } from './runtime/desktop';

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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
