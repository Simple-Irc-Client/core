import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'],
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
