import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('cmdbot');
  await bot.join('#commands');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'cmd-tester', { channels: ['#commands'] });
  await sharedPage.getByRole('button', { name: '#commands', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Slash commands', () => {
  test.describe.configure({ mode: 'serial' });

  test('/me sends action message', async () => {
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('/me waves hello');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('waves hello')).toBeVisible({ timeout: 10_000 });
  });

  test('/nick changes nickname', async () => {
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('/nick cmd-renamed');
    await messageInput.press('Enter');

    // Nick should change in the users sidebar
    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('cmd-renamed')).toBeVisible({ timeout: 10_000 });

    // Change back for subsequent tests
    await messageInput.fill('/nick cmd-tester');
    await messageInput.press('Enter');
    await expect(usersSidebar.getByText('cmd-tester')).toBeVisible({ timeout: 10_000 });
  });

  test('/topic changes channel topic', async () => {
    // First, user needs ops to change topic. Create our own channel for this.
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('/join #cmd-topic-test');
    await messageInput.press('Enter');

    // Switch to the new channel
    await sharedPage.getByRole('button', { name: '#cmd-topic-test', exact: true }).click({ timeout: 10_000 });
    await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Set topic via command (we're op since we created the channel)
    await messageInput.fill('/topic New topic via command');
    await messageInput.press('Enter');

    // Topic should update
    await expect(sharedPage.getByText('New topic via command')).toBeVisible({ timeout: 10_000 });

    // Go back to #commands
    await sharedPage.getByRole('button', { name: '#commands', exact: true }).click();
  });

  test('/join adds channel to sidebar', async () => {
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('/join #cmd-join-test');
    await messageInput.press('Enter');

    // Channel should appear in the sidebar
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: '#cmd-join-test', exact: true })).toBeVisible({ timeout: 10_000 });

    // Go back to #commands
    await sharedPage.getByRole('button', { name: '#commands', exact: true }).click();
  });

  test('/part leaves channel', async () => {
    const channelNav = sharedPage.getByTestId('channels-sidebar');

    // Verify the channel from previous test exists
    await expect(channelNav.getByRole('button', { name: '#cmd-join-test', exact: true })).toBeVisible();

    // Part the channel
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('/part #cmd-join-test');
    await messageInput.press('Enter');

    // Wait for the /part command to be processed
    await sharedPage.waitForTimeout(1000);

    // Channel should be removed from sidebar
    await expect(channelNav.getByRole('button', { name: '#cmd-join-test', exact: true })).not.toBeVisible({ timeout: 15_000 });
  });

  test('/msg sends private message', async () => {
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('/msg cmdbot Hello from command!');
    await messageInput.press('Enter');

    // A DM tab should appear for cmdbot
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: 'cmdbot' })).toBeVisible({ timeout: 10_000 });

    // Click on it to verify the message
    await channelNav.getByRole('button', { name: 'cmdbot' }).click();
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from command!')).toBeVisible({ timeout: 10_000 });

    // Go back to #commands
    await sharedPage.getByRole('button', { name: '#commands', exact: true }).click();
  });
});
