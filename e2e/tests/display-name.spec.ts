import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('dnbot');
  await bot.join('#display-name');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('IRCv3 display name', () => {
  test.describe.configure({ mode: 'serial' });

  test('display name is shown in users sidebar', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dn-viewer', { channels: ['#display-name'] });
    await page.getByRole('button', { name: '#display-name' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });

    // Initially the bot shows its real nick
    await expect(usersSidebar.getByText('dnbot')).toBeVisible({ timeout: 10_000 });

    // Bot sets a display name via METADATA
    bot.send('METADATA * SET display-name :Friendly Bot');

    // Users sidebar should now show the display name
    await expect(usersSidebar.getByText('Friendly Bot')).toBeVisible({ timeout: 10_000 });
  });

  test('display name is shown in chat messages', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dn-chat', { channels: ['#display-name'] });
    await page.getByRole('button', { name: '#display-name' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sets display name first
    bot.send('METADATA * SET display-name :Chat Display Name');

    // Wait for metadata to be processed
    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('Chat Display Name')).toBeVisible({ timeout: 10_000 });

    // Bot sends a message
    bot.sendMessage('#display-name', 'Hello with display name!');

    // The message should appear in chat with the display name shown
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('Hello with display name!')).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText('Chat Display Name')).toBeVisible();
  });

  test('context menu uses real nick, not display name', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dn-ctx', { channels: ['#display-name'] });
    await page.getByRole('button', { name: '#display-name' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });

    // Bot sets display name
    bot.send('METADATA * SET display-name :Pretty Name');

    // Wait for display name to appear
    await expect(usersSidebar.getByText('Pretty Name')).toBeVisible({ timeout: 10_000 });

    // Click on the bot in the users sidebar to open context menu
    await usersSidebar.getByText('Pretty Name').click();

    // Context menu should appear with Whois and Priv options
    await expect(page.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Priv' })).toBeVisible();

    // Click Priv to open a DM tab — the tab should use the real nick, not the display name
    await page.getByRole('menuitem', { name: 'Priv' }).click();

    const channelNav = page.getByRole('navigation', { name: 'Channels' });
    // The DM tab should be named with the real nick "dnbot"
    await expect(channelNav.getByRole('button', { name: 'dnbot' })).toBeVisible({ timeout: 5_000 });
  });

  test('whois command uses real nick', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dn-whois', { channels: ['#display-name'] });
    await page.getByRole('button', { name: '#display-name' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });

    // Bot sets display name
    bot.send('METADATA * SET display-name :Whois Display');

    // Wait for display name to appear
    await expect(usersSidebar.getByText('Whois Display')).toBeVisible({ timeout: 10_000 });

    // Click on bot to open context menu, then Whois
    await usersSidebar.getByText('Whois Display').click();
    await page.getByRole('menuitem', { name: 'Whois' }).click();

    // Whois response should contain the real nick "dnbot"
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText(/dnbot/)).toBeVisible({ timeout: 10_000 });
  });

  test('clearing display name reverts to real nick', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'dn-clear', { channels: ['#display-name'] });
    await page.getByRole('button', { name: '#display-name' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });

    // Bot sets display name
    bot.send('METADATA * SET display-name :Temporary Name');
    await expect(usersSidebar.getByText('Temporary Name')).toBeVisible({ timeout: 10_000 });

    // Bot clears the display name
    bot.send('METADATA * SET display-name :');

    // Should revert to showing real nick
    await expect(usersSidebar.getByText('dnbot')).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText('Temporary Name')).not.toBeVisible();
  });
});
