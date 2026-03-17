import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('badgebot');
  await bot.join('#badge-a');
  await bot.join('#badge-b');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Unread badges', () => {
  test.describe.configure({ mode: 'serial' });

  test('unread badge appears on inactive channel', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'badge-tester', { channels: ['#badge-a', '#badge-b'] });

    // Stay on #badge-a
    await page.getByRole('button', { name: '#badge-a' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sends a message to #badge-b (inactive channel)
    bot.sendMessage('#badge-b', 'Unread message!');

    // A badge should appear on the #badge-b button
    const channelNav = page.getByRole('navigation', { name: 'Channels' });
    const badgeBButton = channelNav.getByRole('button', { name: '#badge-b' }).locator('..');
    await expect(badgeBButton.locator('[aria-label*="unread"]')).toBeVisible({ timeout: 10_000 });
  });

  test('badge clears when switching to channel', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'badge-clear', { channels: ['#badge-a', '#badge-b'] });

    // Stay on #badge-a
    await page.getByRole('button', { name: '#badge-a' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sends a message to #badge-b
    bot.sendMessage('#badge-b', 'Will be read soon');

    // Wait for badge to appear
    const channelNav = page.getByRole('navigation', { name: 'Channels' });
    const badgeBContainer = channelNav.getByRole('button', { name: '#badge-b' }).locator('..');
    await expect(badgeBContainer.locator('[aria-label*="unread"]')).toBeVisible({ timeout: 10_000 });

    // Click #badge-b to switch to it
    await page.getByRole('button', { name: '#badge-b' }).click();

    // Badge should disappear
    await expect(badgeBContainer.locator('[aria-label*="unread"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('mention badge has destructive styling', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'mention-tester', { channels: ['#badge-a', '#badge-b'] });

    // Stay on #badge-a
    await page.getByRole('button', { name: '#badge-a' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sends a message mentioning the user's nick in #badge-b
    bot.sendMessage('#badge-b', 'Hey mention-tester, look at this!');

    // A badge with mention styling should appear
    const channelNav = page.getByRole('navigation', { name: 'Channels' });
    const badgeBContainer = channelNav.getByRole('button', { name: '#badge-b' }).locator('..');
    await expect(badgeBContainer.locator('[aria-label*="mention"]')).toBeVisible({ timeout: 10_000 });
  });
});
