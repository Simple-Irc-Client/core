import { test, expect } from '@playwright/test';
import { connectViaWizard } from '../helpers';

test.describe('Reconnect', () => {
  test.describe.configure({ mode: 'serial' });

  test('disconnect shows banner and manual reconnect works', async ({ page }) => {
    // Intercept WebSocket creation BEFORE the page loads.
    await page.addInitScript(() => {
      const OrigWS = globalThis.WebSocket;
      const allSockets: WebSocket[] = [];

      // Replace WebSocket constructor to track all instances
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).WebSocket = function (url: string, protocols?: string | string[]) {
        const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
        allSockets.push(ws);
        return ws;
      };
      // Preserve static properties and prototype
      (globalThis as any).WebSocket.prototype = OrigWS.prototype;
      (globalThis as any).WebSocket.CONNECTING = OrigWS.CONNECTING;
      (globalThis as any).WebSocket.OPEN = OrigWS.OPEN;
      (globalThis as any).WebSocket.CLOSING = OrigWS.CLOSING;
      (globalThis as any).WebSocket.CLOSED = OrigWS.CLOSED;

      // Expose close helper
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__closeAllWS = () => {
        let closed = 0;
        for (const ws of allSockets) {
          if (ws.readyState === OrigWS.OPEN || ws.readyState === OrigWS.CONNECTING) {
            ws.close();
            closed++;
          }
        }
        return { total: allSockets.length, closed };
      };
    });

    await page.goto('/');
    await connectViaWizard(page, 'reconnect-user', { channels: [] });
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });

    // Close all WebSocket connections to simulate disconnect.
    // This triggers the onclose handler immediately, which sets isConnected=false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (globalThis as any).__closeAllWS());

    // Disconnect banner should appear (text appears in multiple places — sidebar, header, users panel)
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    // The Connect button should be visible in the disconnect banner
    const reconnectButton = page.getByRole('button', { name: 'Connect' });
    await expect(reconnectButton).toBeVisible();

    // Click reconnect
    await reconnectButton.click();

    // Banner should disappear once reconnected
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });

    // Message input should be enabled again
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  });
});
