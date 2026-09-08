import { test, expect, type Page } from '@playwright/test';
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

/** Wizard through with no channels, then join CHANNEL and land on it. */
const setUpOnChannel = async (page: Page, nick: string): Promise<void> => {
  await installWebSocketKillSwitch(page);
  await page.goto('/');
  await connectViaWizard(page, nick, { channels: [] });

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

  test('reconnects on the browser `online` event without a manual Connect', async ({ page }) => {
    await setUpOnChannel(page, 'mobile-recon-online');

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

  test('reconnects when the tab becomes visible again', async ({ page }) => {
    await setUpOnChannel(page, 'mobile-recon-visible');

    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    // document.visibilityState is 'visible' for a foregrounded Playwright page,
    // so the visibilitychange handler treats this as "tab came back".
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
  });

  test('a manual Connect from the disconnect banner also keeps the current view', async ({ page }) => {
    await setUpOnChannel(page, 'mobile-recon-manual');

    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page.getByTestId('chat-log').getByText('Reconnecting to server...').first())
      .toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('chat-header-name')).toContainText(CHANNEL);
  });
});
