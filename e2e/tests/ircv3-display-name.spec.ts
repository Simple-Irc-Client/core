import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  skipWithoutIrcv3('display names are METADATA');
  bot = await createIrcClient(`dnbot-${tag}`, '127.0.0.1', 6667, ['draft/metadata-2']);
  await bot.join(`#display-name-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `dn-viewer-${tag}`, { channels: [`#display-name-${tag}`] });
  await page.getByRole('button', { name: `#display-name-${tag}`, exact: true }).click();
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('IRCv3 display name', () => {
  test('display name is shown in users sidebar', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Initially the bot shows its real nick
    await expect(usersSidebar.getByText(`dnbot-${tag}`)).toBeVisible({ timeout: 10_000 });

    // Bot sets a display name via METADATA
    bot.send('METADATA * SET display-name :Friendly Bot');

    // Users sidebar should now show the display name
    await expect(usersSidebar.getByText('Friendly Bot')).toBeVisible({ timeout: 10_000 });
  });

  test('display name is shown in chat messages', async () => {
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sets display name first
    bot.send('METADATA * SET display-name :Chat Display Name');

    // Wait for metadata to be processed
    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('Chat Display Name')).toBeVisible({ timeout: 10_000 });

    // Bot sends a message
    bot.sendMessage(`#display-name-${tag}`, 'Hello with display name!');

    // The message should appear in chat with the display name shown
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello with display name!')).toBeVisible({ timeout: 10_000 });
    // The nick renders in two slots (header + inline); the active theme shows one
    await expect(chatLog.getByText('Chat Display Name').first()).toBeVisible();
  });

  test('context menu uses real nick, not display name', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

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

    const channelNav = page.getByTestId('channels-sidebar');
    // The DM tab should be named with the real nick "dnbot"
    await expect(channelNav.getByRole('button', { name: `dnbot-${tag}` })).toBeVisible({ timeout: 5_000 });
  });

  test('whois command uses real nick', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Bot sets display name
    bot.send('METADATA * SET display-name :Whois Display');

    // Wait for display name to appear
    await expect(usersSidebar.getByText('Whois Display')).toBeVisible({ timeout: 10_000 });

    // Click on bot to open context menu, then Whois
    await usersSidebar.getByText('Whois Display').click();
    await page.getByRole('menuitem', { name: 'Whois' }).click();

    // Whois response should contain the real nick "dnbot"
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(bot.nick).first()).toBeVisible({ timeout: 10_000 });
  });

  test('clearing display name reverts to real nick', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Bot sets display name
    bot.send('METADATA * SET display-name :Temporary Name');
    await expect(usersSidebar.getByText('Temporary Name')).toBeVisible({ timeout: 10_000 });

    // Bot clears the display name
    bot.send('METADATA * SET display-name :');

    // Should revert to showing real nick
    await expect(usersSidebar.getByText(`dnbot-${tag}`)).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText('Temporary Name')).not.toBeVisible();
  });
});
