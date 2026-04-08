import { defineConfig, devices } from '@playwright/test';

const chromiumConfig = {
  ...devices['Desktop Chrome'],
  // Required to accept the self-signed cert used for ergo's WSS listener
  launchOptions: {
    args: ['--ignore-certificate-errors'],
  },
};

const firefoxConfig = {
  ...devices['Desktop Firefox'],
  launchOptions: {
    firefoxUserPrefs: {
      // Required to accept the self-signed cert used for ergo's WSS listener
      'network.stricttransportsecurity.preloadlist': false,
      'security.cert_pinning.enforcement_level': 0,
    },
  },
};

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
    baseURL: 'http://localhost:5173',
    locale: 'en-US',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-parallel',
      use: chromiumConfig,
      testIgnore: [/reconnect\.spec/, /input-context-menu\.spec/],
    },
    {
      name: 'firefox-parallel',
      use: firefoxConfig,
      testIgnore: [/reconnect\.spec/, /input-context-menu\.spec/],
    },
    {
      name: 'chromium-reconnect',
      use: chromiumConfig,
      testMatch: /reconnect\.spec/,
      dependencies: ['chromium-parallel'],
    },
    {
      name: 'firefox-reconnect',
      use: firefoxConfig,
      testMatch: /reconnect\.spec/,
      dependencies: ['firefox-parallel'],
    },
    {
      name: 'chromium-clipboard',
      use: {
        ...chromiumConfig,
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      testMatch: /input-context-menu\.spec/,
    },
    {
      name: 'firefox-clipboard',
      use: {
        ...firefoxConfig,
        ignoreHTTPSErrors: true,
      },
      testMatch: /input-context-menu\.spec/,
    },
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
