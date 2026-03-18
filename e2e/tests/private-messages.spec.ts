import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('dmbot');
  await bot.join('#dm-test');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'dm-tester', { channels: ['#dm-test'] });
  await sharedPage.getByRole('button', { name: '#dm-test', exact: true }).click();
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Private messages', () => {
  test.describe.configure({ mode: 'serial' });

  test('receiving a DM creates a new tab in channel sidebar', async () => {
    const channelNav = sharedPage.getByTestId('channels-sidebar');

    // Bot sends a private message to the test user
    bot.sendMessage('dm-tester', 'Hello from DM bot!');

    // A new tab for the bot should appear in the sidebar
    await expect(channelNav.getByRole('button', { name: 'dmbot' })).toBeVisible({ timeout: 10_000 });

    // Click on the DM tab
    await channelNav.getByRole('button', { name: 'dmbot' }).click();

    // The message should be visible in the chat log
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from DM bot!')).toBeVisible({ timeout: 5_000 });
  });

  test('can reply to a DM', async () => {
    // Navigate back to #dm-test (test 1 left us on the dmbot tab)
    await sharedPage.getByRole('button', { name: '#dm-test', exact: true }).click();

    const channelNav = sharedPage.getByTestId('channels-sidebar');

    // Bot sends a DM
    bot.sendMessage('dm-tester', 'Can you reply?');

    // Wait for DM tab
    await expect(channelNav.getByRole('button', { name: 'dmbot' })).toBeVisible({ timeout: 10_000 });
    await channelNav.getByRole('button', { name: 'dmbot' }).click();

    // Reply
    const messageInput = sharedPage.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 5_000 });
    await messageInput.fill('Yes, here is my reply!');
    await messageInput.press('Enter');

    // Reply should appear in chat log
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Yes, here is my reply!')).toBeVisible({ timeout: 10_000 });
  });

  test('DM messages do not appear in channel tabs', async () => {
    // Ensure we're on #dm-test
    await sharedPage.getByRole('button', { name: '#dm-test', exact: true }).click();

    // Bot sends a DM
    bot.sendMessage('dm-tester', 'This is a private message');

    // Wait for DM tab to appear
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: 'dmbot' })).toBeVisible({ timeout: 10_000 });

    // Stay on #dm-test — the DM message should NOT appear in the channel chat log
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('This is a private message')).not.toBeVisible();
  });
});
