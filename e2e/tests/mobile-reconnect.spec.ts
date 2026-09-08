import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch } from '../helpers';

/**
 * Event-driven reconnect, the way mobile web actually recovers.
 *
 * On phones the time-based inactivity watchdog can't be trusted: a backgrounded
 * tab has its timers frozen, so the app leans on the browser's own `online`
 * event and the tab regaining visibility (`startReachabilityWatch` /
 * `handleNetworkMaybeBack` in network.ts). These tests fire those DOM events
 * directly — no "Connect" button — and check that:
 *
 *   1. the app reconnects on its own,
 *   2. it says so ("Reconnecting to server...") instead of jumping straight to a
 *      mid-flow notice like the STS upgrade line, and
 *   3. it does NOT yank the view back to Status — the user stays on whatever
 *      channel/DM they were reading (kernel.ts `handleConnect`).
 *
 * Named *-reconnect.spec.ts so playwright.config.ts routes it to the serial
 * reconnect project: force-closing every socket is too disruptive to run
 * alongside the rest of the suite.
 */

const CHANNEL = '#mobile-recon';

/**
 * Wizard through with no channels, then join CHANNEL and land on it.
 *
 * The nick is suffixed per project: chromium-reconnect and firefox-reconnect run
 * this file concurrently against one shared Ergo server, and identical nicks
 * race to 433. See e2e-testing-gotchas.
 */
const setUpOnChannel = async (page: Page, baseNick: string, testInfo: TestInfo): Promise<void> => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  await installWebSocketKillSwitch(page);
  await page.goto('/');
  await connectViaWizard(page, `${baseNick}-${tag}`, { channels: [] });

  const input = page.locator('#message-input');
  await expect(input).toBeEnabled({ timeout: 10_000 });
  await input.fill(`/join ${CHANNEL}`);
  await input.press('Enter');

  await expect(page.getByTestId('channels-sidebar').getByRole('button', { name: CHANNEL, exact: true }))
    .toBeVisible({ timeout: 10_000 });
  // A fresh join switches the view to the channel; make sure we're there.
  await page.getByTestId('channels-sidebar').getByRole('button', { name: CHANNEL, exact: true }).click();
  await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
};

test.describe('Mobile event-driven reconnect', () => {
  test.describe.configure({ mode: 'serial' });

  test('reconnects on the browser `online` event without a manual Connect', async ({ page }, testInfo) => {
    await setUpOnChannel(page, 'mob-rec-online', testInfo);

    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    // The signal a returning mobile connection actually produces — no click.
    await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));

    // It announces the attempt rather than going silent until the next status line.
    await expect(page.getByTestId('chat-log').getByText('Reconnecting to server...').first())
      .toBeVisible({ timeout: 10_000 });

    // ...and it comes back on its own.
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // The view stayed on the channel — it was not forced to Status.
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
  });

  test('reconnects when the tab becomes visible again', async ({ page }, testInfo) => {
    await setUpOnChannel(page, 'mob-rec-visible', testInfo);

    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    // document.visibilityState is 'visible' for a foregrounded Playwright page,
    // so the visibilitychange handler treats this as "tab came back".
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
  });

  test('a manual Connect from the disconnect banner also keeps the current view', async ({ page }, testInfo) => {
    await setUpOnChannel(page, 'mob-rec-manual', testInfo);

    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page.getByTestId('chat-log').getByText('Reconnecting to server...').first())
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
  });

  test('reconnecting after a page reload keeps the restored view, not Status', async ({ page }, testInfo) => {
    await setUpOnChannel(page, 'mob-rec-reload', testInfo);

    // Send a line so the window has content, and let the channels/settings
    // stores flush (2s IndexedDB debounce) before the reload.
    const input = page.locator('#message-input');
    await input.fill('anchor message before reload');
    await input.press('Enter');
    await expect(page.getByTestId('chat-log').getByText('anchor message before reload')).toBeVisible();
    await page.waitForTimeout(2500);

    // A reload is a fresh JS session: persisted windows + currentChannelName are
    // restored, and the app comes up disconnected. This is the exact shape of
    // the bug — on mobile the webview is reloaded in the background, so the next
    // "Connect" looks like a first connect.
    await page.reload();
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 20_000 });
    // The restored view is the channel, still, while disconnected.
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);

    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // handleConnect must NOT have forced the view to Status — a real restored
    // window was already showing.
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
    await expect(page.getByTestId('chat-header-name')).not.toHaveText('Status');
    await expect(page.getByTestId('chat-log').getByText('anchor message before reload')).toBeVisible({ timeout: 10_000 });
  });
});
