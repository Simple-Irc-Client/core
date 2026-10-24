import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
import { checkForUpdates } from './runtime/desktop';
import { initSentry } from './runtime/sentry';
import { initServiceWorker } from './runtime/serviceWorker';
import { initMobileNotifications } from './runtime/notifications';
import { initSounds } from './features/sounds/sounds';

initSentry();

console.log(`Simple IRC Client [${__GIT_REF__}]`);

void initServiceWorker();

void checkForUpdates();

void initMobileNotifications();

initSounds();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
