/**
 * Sentry setup. Every event carries what build produced it, so a report can be
 * tied to the code that was running:
 *
 *  - `release`: the core git commit (the same ref logged at startup).
 *  - `runtime` tag: web, desktop or mobile.
 *  - `app.version` tag: the Tauri app version (e.g. 2.0.9), desktop/mobile only.
 *    Tauri only exposes it asynchronously, so it is attached once the lookup
 *    resolves; events from the first moments of startup can lack it.
 */
import * as Sentry from '@sentry/react';
import { getAppVersion, isDesktop, isMobile } from './desktop';

const runtimeName = (): string => {
  if (!isDesktop()) {
    return 'web';
  }
  return isMobile() ? 'mobile' : 'desktop';
};

export const initSentry = (): void => {
  Sentry.init({
    dsn: import.meta.env['VITE_SENTRY_DSN'],
    release: `simple-irc-client@${__GIT_REF__}`,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    initialScope: { tags: { runtime: runtimeName() } },
  });

  void getAppVersion().then((version) => {
    if (version !== null) {
      Sentry.setTag('app.version', version);
    }
  });
};
