import { defineConfig, devices, type Project } from '@playwright/test';
import { APP_PORT, GATEWAY_APP_PORT, GATEWAY_PORT, IRC_PORT, LEGACY_IRC_PORT } from './e2e/global-setup';
import type { TestServer } from './e2e/test-server';

const chromiumConfig = {
  ...devices['Desktop Chrome'],
  launchOptions: {
    // The certificate flag accepts the self-signed cert of ergo's WSS listener; muting keeps notification sounds off the speakers
    args: ['--ignore-certificate-errors', '--mute-audio'],
  },
};

const firefoxConfig = {
  ...devices['Desktop Firefox'],
  ignoreHTTPSErrors: true,
  launchOptions: {
    firefoxUserPrefs: {
      // Required to accept the self-signed cert used for ergo's WSS listener
      'network.stricttransportsecurity.preloadlist': false,
      'security.cert_pinning.enforcement_level': 0,
      // Keeps notification sounds off the speakers
      'media.volume_scale': '0.0',
    },
  },
};

const browsers = [
  { browser: 'chromium', use: chromiumConfig, clipboardUse: { permissions: ['clipboard-read', 'clipboard-write'] } },
  { browser: 'firefox', use: firefoxConfig, clipboardUse: {} },
];

const RECONNECT_SPECS = /reconnect\.spec/;
const CLIPBOARD_SPECS = /input-context-menu\.spec/;
const GATEWAY_SPECS = /gateway-.*\.spec/;
const GATEWAY_APP_URL = `http://localhost:${GATEWAY_APP_PORT}`;

/** Per browser: most specs in parallel, the reconnect specs after them, the clipboard specs with clipboard access. */
const suiteProjects = (
  variant: string,
  server: TestServer,
  options: { baseURL?: string; testIgnore?: RegExp[] } = {},
): Project[] =>
  browsers.flatMap(({ browser, use, clipboardUse }) => {
    const name = (group: string): string => [browser, variant, group].filter(Boolean).join('-');
    const projectUse = { ...use, ...(options.baseURL ? { baseURL: options.baseURL } : {}) };
    const ignored = options.testIgnore ?? [];
    return [
      { name: name('parallel'), use: projectUse, metadata: server, testIgnore: [RECONNECT_SPECS, CLIPBOARD_SPECS, ...ignored] },
      { name: name('reconnect'), use: projectUse, metadata: server, testMatch: RECONNECT_SPECS, testIgnore: ignored, dependencies: [name('parallel')] },
      { name: name('clipboard'), use: { ...projectUse, ...clipboardUse }, metadata: server, testMatch: CLIPBOARD_SPECS, testIgnore: ignored },
    ];
  });

const ergoProjects: Project[] = [
  ...suiteProjects('', { name: 'ergo', ircv3: true, ircPort: IRC_PORT, viaGateway: false }, { testIgnore: [GATEWAY_SPECS] }),
  // The app built for the gateway, which relays to the IRC server instead of the browser connecting directly
  ...browsers.map(({ browser, use }) => ({
    name: `${browser}-gateway`,
    use: { ...use, baseURL: GATEWAY_APP_URL },
    metadata: { name: 'ergo', ircv3: true, ircPort: IRC_PORT, viaGateway: true } satisfies TestServer,
    testMatch: GATEWAY_SPECS,
  })),
];

// The whole suite again on ngircd, which has no IRCv3 and no WebSocket listener, so only the gateway reaches it
const legacyProjects = suiteProjects('legacy', { name: 'ngircd', ircv3: false, ircPort: LEGACY_IRC_PORT, viaGateway: true }, { baseURL: GATEWAY_APP_URL });

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60_000,

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    locale: 'en-US',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [...ergoProjects, ...legacyProjects],

  webServer: [
    {
      command: `pnpm exec vite --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `pnpm exec vite --port ${GATEWAY_APP_PORT} --strictPort`,
      url: `http://localhost:${GATEWAY_APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        VITE_GATEWAY_HOST: 'localhost',
        VITE_GATEWAY_PORT: String(GATEWAY_PORT),
        VITE_GATEWAY_PATH: '/webirc',
      },
    },
  ],
});
