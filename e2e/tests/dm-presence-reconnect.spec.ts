import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

// Named *-reconnect.spec.ts on purpose: playwright.config.ts routes anything
// matching /reconnect\.spec/ to the dedicated, non-parallel reconnect
// project, because closing every WebSocket on the page (below) is disruptive
// enough that it shouldn't run concurrently with the rest of the e2e suite.
test.describe('DM presence indicator survives our own disconnect/reconnect', () => {
  test('does not keep showing a peer as online once our own connection drops', async ({ page }) => {
    const bot: IrcClient = await createIrcClient('dmp-recon-bot');

    // Intercept WebSocket creation BEFORE the page loads, same technique as
    // reconnect.spec.ts, so we can force-close our own connection later.
    await page.addInitScript(() => {
      const OrigWS = globalThis.WebSocket;
      const allSockets: WebSocket[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket = function (url: string, protocols?: string | string[]) {
        const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
        allSockets.push(ws);
        return ws;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket.prototype = OrigWS.prototype;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket.CONNECTING = OrigWS.CONNECTING;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket.OPEN = OrigWS.OPEN;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket.CLOSING = OrigWS.CLOSING;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket.CLOSED = OrigWS.CLOSED;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__closeAllWS = () => {
        for (const ws of allSockets) {
          if (ws.readyState === OrigWS.OPEN || ws.readyState === OrigWS.CONNECTING) {
            ws.close();
          }
        }
      };
    });

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (globalThis as any).__closeAllWS());
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
