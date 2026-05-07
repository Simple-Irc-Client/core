import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import * as Sentry from '@sentry/react';
import { checkForUpdates } from './runtime/desktop';

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'],
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});

console.log(`Simple IRC Client [${__GIT_REF__}]`);

// Fire-and-forget update check on desktop builds. No-op in the website.
void checkForUpdates();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
