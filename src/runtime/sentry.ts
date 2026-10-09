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
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.2,
    // Buffer only: a replay is uploaded with the error or warning it led up to
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    initialScope: { tags: { runtime: runtimeName() } },
    // Keep the restrictive v10 defaults: v11 otherwise collects user info, cookies and HTTP bodies
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    // v11 defaults this to true, which marks sessions errored on every captureMessage warning
    attachStacktrace: false,
  });

  void getAppVersion().then((version) => {
    if (version !== null) {
      Sentry.setTag('app.version', version);
    }
  });
};
