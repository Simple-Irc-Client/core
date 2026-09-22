import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import { checkForUpdates } from './runtime/desktop';
import { initSentry } from './runtime/sentry';
import { initServiceWorker } from './runtime/serviceWorker';
import { initMobileNotifications } from './runtime/notifications';

initSentry();

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
