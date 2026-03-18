import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('joinbot');
  await bot.join('#joinable');
  await bot.setTopic('#joinable', 'Come join us');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Join channel button', () => {
  test.describe.configure({ mode: 'serial' });

  test('join button opens channel list dialog', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'join-tester');

    // The join channel button should be visible in the sidebar
    const channelNav = page.getByTestId('channels-sidebar');
    const joinButton = channelNav.getByRole('button', { name: /join channel/i });
    await expect(joinButton).toBeVisible({ timeout: 10_000 });

    // Click the join button
    await joinButton.click();

    // Channel list dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Join Channels')).toBeVisible();
    await expect(page.getByText('Select channels to join from the list below')).toBeVisible();
  });

  test('channel list dialog shows available channels', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'list-tester');

    const channelNav = page.getByTestId('channels-sidebar');
    await channelNav.getByRole('button', { name: /join channel/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // #joinable should appear in the list (bot created it)
    await expect(page.getByText('#joinable')).toBeVisible({ timeout: 10_000 });
  });

  test('selecting and joining a channel from dialog', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dialog-joiner');

    const channelNav = page.getByTestId('channels-sidebar');
    await channelNav.getByRole('button', { name: /join channel/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    // Wait for channels to load and select #joinable
    await expect(page.getByText('#joinable')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /joinable/ }).click();

    // Join button should be enabled now
    const dialogJoinButton = page.getByRole('dialog').getByRole('button', { name: 'Join', exact: true });
    await expect(dialogJoinButton).toBeEnabled();
    await dialogJoinButton.click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Channel should appear in the sidebar
    await expect(channelNav.getByRole('button', { name: '#joinable', exact: true })).toBeVisible({ timeout: 10_000 });

    // Click on it and verify topic
    await channelNav.getByRole('button', { name: '#joinable', exact: true }).click();
    await expect(page.getByTestId('topic-display')).toHaveText('Come join us', { timeout: 5_000 });
  });

  test('already-joined channels are excluded from dialog', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'exclude-tester', { channels: ['#joinable'] });

    const channelNav = page.getByTestId('channels-sidebar');

    // Open channel list dialog
    await channelNav.getByRole('button', { name: /join channel/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // #joinable should NOT appear since we already joined it
    // Wait for list to load first
    await new Promise((r) => setTimeout(r, 2000));
    const rows = page.getByRole('dialog').getByRole('button', { name: /joinable/ });
    await expect(rows).toHaveCount(0);
  });

  test('cancel button closes dialog without joining', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'cancel-tester');

    const channelNav = page.getByTestId('channels-sidebar');
    await channelNav.getByRole('button', { name: /join channel/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });
});
