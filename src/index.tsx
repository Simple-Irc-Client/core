import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import * as Sentry from '@sentry/react';
import { checkForUpdates } from './runtime/desktop';
import { initServiceWorker } from './runtime/serviceWorker';
import { initMobileNotifications } from './runtime/notifications';

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'],
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});

console.log(`Simple IRC Client [${__GIT_REF__}]`);

// Registers the service worker on the website, removes it in Tauri builds.
void initServiceWorker();

// Fire-and-forget update check on desktop builds. No-op in the website.
void checkForUpdates();

// Request notification permission on mobile (no-op on web/desktop).
void initMobileNotifications();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
