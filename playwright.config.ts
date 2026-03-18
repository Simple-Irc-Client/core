import { defineConfig, devices } from '@playwright/test';

const chromiumConfig = {
  ...devices['Desktop Chrome'],
  // Required to accept the self-signed cert used for ergo's WSS listener
  launchOptions: {
    args: ['--ignore-certificate-errors'],
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
      name: 'parallel',
      use: chromiumConfig,
      testIgnore: /reconnect\.spec/,
    },
    {
      name: 'reconnect',
      use: chromiumConfig,
      testMatch: /reconnect\.spec/,
      dependencies: ['parallel'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
