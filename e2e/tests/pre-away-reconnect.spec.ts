import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch, projectTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

/**
 * draft/pre-away: a connection the app opens while nobody is looking (a phone reconnecting in the background)
 * registers as "not present", so a bouncer doesn't take it for the user coming back. Named *-reconnect.spec.ts
 * for the serial reconnect project: force-closing sockets is too disruptive to run alongside the rest.
 */

const CHANNEL = '#pre-away';
const NO_LONGER_AWAY = 'You are no longer marked as being away';

/** Lets the test hide and show the page the way a phone backgrounding the browser does */
const installVisibilitySwitch = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: () => ((globalThis as any).__visibility as DocumentVisibilityState | undefined) ?? 'visible',
    });
  });
};

const setVisibility = async (page: Page, visibility: DocumentVisibilityState): Promise<void> => {
  await page.evaluate((value) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__visibility = value;
    document.dispatchEvent(new Event('visibilitychange'));
  }, visibility);
};

test.describe('Reconnecting in the background', () => {
  test('registers as not present until the user looks, without telling them about it', async ({ page }, testInfo) => {
    skipWithoutIrcv3('draft/pre-away is an IRCv3 extension');
    const nick = `preaway-${projectTag(testInfo)}`;
    const debugLog = page.getByTestId('chat-log');

    await installWebSocketKillSwitch(page);
    await installVisibilitySwitch(page);
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [] });
    const input = page.locator('#message-input');
    await expect(input).toBeEnabled({ timeout: 10_000 });
    await input.fill(`/join ${CHANNEL}`);
    await input.press('Enter');
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL, { timeout: 10_000 });

    await setVisibility(page, 'hidden');
    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });
    // A returning network wakes the app while it is still in the background
    await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });

    // The server answered an AWAY sent before registration: its reply has no nick to go to yet
    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    await expect(debugLog.getByText(new RegExp(`305 \\* :${NO_LONGER_AWAY}`))).toHaveCount(1, { timeout: 10_000 });

    await setVisibility(page, 'visible');
    await expect(debugLog.getByText(new RegExp(`305 ${nick} :${NO_LONGER_AWAY}`))).toHaveCount(1, { timeout: 10_000 });

    // Both were the app's own doing, not something to report to the user
    await page.getByRole('button', { name: CHANNEL, exact: true }).click();
    await expect(page.getByTestId('chat-log').getByText(new RegExp(NO_LONGER_AWAY))).toHaveCount(0);
  });
});
