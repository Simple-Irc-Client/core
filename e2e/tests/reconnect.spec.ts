import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { connectViaWizard } from '../helpers';

const ERGO_CONTAINER = 'sic-e2e-ergo';

test.describe('Reconnect', () => {
  test.describe.configure({ mode: 'serial' });

  test('disconnect shows banner and manual reconnect works', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'reconnect-user', { channels: [] });
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });

    // Pause the ergo container to simulate a disconnect
    execSync(`docker pause ${ERGO_CONTAINER}`);

    // Disconnect banner should appear
    await expect(page.getByText('Not connected to server')).toBeVisible({ timeout: 30_000 });

    // The Reconnect button should be visible
    const reconnectButton = page.getByRole('button', { name: 'Connect' });
    await expect(reconnectButton).toBeVisible();

    // Unpause the container
    execSync(`docker unpause ${ERGO_CONTAINER}`);

    // Click reconnect
    await reconnectButton.click();

    // Banner should disappear once reconnected
    await expect(page.getByText('Not connected to server')).not.toBeVisible({ timeout: 30_000 });

    // Message input should be enabled again
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  });
});
