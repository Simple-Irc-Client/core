import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

// Named *-reconnect.spec.ts on purpose: playwright.config.ts routes anything
// matching /reconnect\.spec/ to the dedicated, non-parallel reconnect
// project, because closing every WebSocket on the page (below) is disruptive
// enough that it shouldn't run concurrently with the rest of the e2e suite.
test.describe('DM presence indicator survives our own disconnect/reconnect', () => {
  test('does not keep showing a peer as online once our own connection drops', async ({ page }) => {
    skipWithoutIrcv3('presence comes from MONITOR');
    const bot: IrcClient = await createIrcClient('dmp-recon-bot');

    // Installed before the page loads, so we can force-close our own connection later
    await installWebSocketKillSwitch(page);
    await page.goto('/');
    await connectViaWizard(page, 'dmp-recon-tester', { channels: [] });

    const channelNav = page.getByTestId('channels-sidebar');
    const dmRow = channelNav.getByRole('button', { name: 'dmp-recon-bot', exact: true });

    bot.sendMessage('dmp-recon-tester', 'hi');
    await expect(dmRow).toBeVisible({ timeout: 10_000 });
    await expect(dmRow.getByLabel('Online')).toBeVisible({ timeout: 10_000 });
    await dmRow.click();

    // Force-close our own connection. The bot stays online and reachable —
    // only OUR client's view of that fact goes away.
    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    // The window itself must stay (it's local state), but the dot must not
    // keep asserting "online" — we have no live connection to vouch for that.
    await expect(dmRow).toBeVisible();
    await expect(dmRow.getByLabel('Online')).toHaveCount(0);

    // Reconnect: a fresh MONITOR subscription should confirm the bot is
    // (still) online again, not leave the dot missing or wrong forever.
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(dmRow.getByLabel('Online')).toBeVisible({ timeout: 15_000 });

    bot.disconnect();
  });
});
