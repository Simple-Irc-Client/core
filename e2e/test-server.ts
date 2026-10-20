import { test } from '@playwright/test';

/** The IRC server a Playwright project tests against (its `metadata` in playwright.config.ts). */
export interface TestServer {
  name: 'ergo' | 'ngircd';
  ircv3: boolean;
  /** The server's plain IRC port */
  ircPort: number;
  /** The app is built for the gateway; otherwise it connects straight to ergo's WebSocket */
  viaGateway: boolean;
}

export const testServer = (): TestServer => test.info().project.metadata as TestServer;

/** Skips the current test, or every test of the group when called in beforeAll, on a server without IRCv3. */
export const skipWithoutIrcv3 = (reason: string): void => {
  test.skip(!testServer().ircv3, `needs IRCv3: ${reason}`);
};
