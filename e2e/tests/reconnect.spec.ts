import { test, expect } from '@playwright/test';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch, testTag } from '../helpers';

test.describe('Reconnect', () => {
  test('disconnect shows banner and manual reconnect works', async ({ page }, testInfo) => {
    const tag = testTag(testInfo);
    await installWebSocketKillSwitch(page);
    await page.goto('/');
    await connectViaWizard(page, `reconnect-user-${tag}`, { channels: [] });
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });

    // Close the app's WebSocket to simulate a disconnect: its onclose handler sets isConnected=false at once.
    await dropConnection(page);

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
