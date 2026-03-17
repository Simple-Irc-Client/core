import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('dmbot');
  await bot.join('#dm-test');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Private messages', () => {
  test.describe.configure({ mode: 'serial' });

  test('receiving a DM creates a new tab in channel sidebar', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dm-tester', { channels: ['#dm-test'] });
    await page.getByRole('button', { name: '#dm-test' }).click();

    const channelNav = page.getByRole('navigation', { name: 'Channels' });

    // Bot sends a private message to the test user
    bot.sendMessage('dm-tester', 'Hello from DM bot!');

    // A new tab for the bot should appear in the sidebar
    await expect(channelNav.getByRole('button', { name: 'dmbot' })).toBeVisible({ timeout: 10_000 });

    // Click on the DM tab
    await channelNav.getByRole('button', { name: 'dmbot' }).click();

    // The message should be visible in the chat log
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('Hello from DM bot!')).toBeVisible({ timeout: 5_000 });
  });

  test('can reply to a DM', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'reply-tester', { channels: ['#dm-test'] });
    await page.getByRole('button', { name: '#dm-test' }).click();

    const channelNav = page.getByRole('navigation', { name: 'Channels' });

    // Bot sends a DM
    bot.sendMessage('reply-tester', 'Can you reply?');

    // Wait for DM tab
    await expect(channelNav.getByRole('button', { name: 'dmbot' })).toBeVisible({ timeout: 10_000 });
    await channelNav.getByRole('button', { name: 'dmbot' }).click();

    // Reply
    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 5_000 });
    await messageInput.fill('Yes, here is my reply!');
    await messageInput.press('Enter');

    // Reply should appear in chat log
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('Yes, here is my reply!')).toBeVisible({ timeout: 10_000 });
  });

  test('DM messages do not appear in channel tabs', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'iso-tester', { channels: ['#dm-test'] });
    await page.getByRole('button', { name: '#dm-test' }).click();

    // Bot sends a DM
    bot.sendMessage('iso-tester', 'This is a private message');

    // Wait for DM tab to appear
    const channelNav = page.getByRole('navigation', { name: 'Channels' });
    await expect(channelNav.getByRole('button', { name: 'dmbot' })).toBeVisible({ timeout: 10_000 });

    // Stay on #dm-test — the DM message should NOT appear in the channel chat log
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('This is a private message')).not.toBeVisible();
  });
});
