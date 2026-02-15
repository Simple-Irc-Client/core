import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'],
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
