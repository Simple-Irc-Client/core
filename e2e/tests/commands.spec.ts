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

  bot = await createIrcClient(`cmdbot-${tag}`);
  await bot.join(`#commands-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `cmd-tester-${tag}`, { channels: [`#commands-${tag}`] });
  await page.getByRole('button', { name: `#commands-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Slash commands', () => {
  test('/me sends action message', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill('/me waves hello');
    await messageInput.press('Enter');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('waves hello')).toBeVisible({ timeout: 10_000 });
  });

  test('/nick changes nickname', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/nick cmd-renamed-${tag}`);
    await messageInput.press('Enter');

    // Nick should change in the users sidebar
    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText(`cmd-renamed-${tag}`)).toBeVisible({ timeout: 10_000 });
  });

  test('/topic changes channel topic', async () => {
    // First, user needs ops to change topic. Create our own channel for this.
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/join #cmd-topic-test-${tag}`);
    await messageInput.press('Enter');

    // Switch to the new channel
    await page.getByRole('button', { name: `#cmd-topic-test-${tag}`, exact: true }).click({ timeout: 10_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Set topic via command (we're op since we created the channel)
    await messageInput.fill('/topic New topic via command');
    await messageInput.press('Enter');

    // Topic should update
    await expect(page.getByText('New topic via command')).toBeVisible({ timeout: 10_000 });
  });

  test('/join adds channel to sidebar', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/join #cmd-join-test-${tag}`);
    await messageInput.press('Enter');

    // Channel should appear in the sidebar
    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: `#cmd-join-test-${tag}`, exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('/part leaves channel', async () => {
    const channelNav = page.getByTestId('channels-sidebar');
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/join #cmd-part-test-${tag}`);
    await messageInput.press('Enter');
    await expect(channelNav.getByRole('button', { name: `#cmd-part-test-${tag}`, exact: true })).toBeVisible({ timeout: 10_000 });

    await messageInput.fill(`/part #cmd-part-test-${tag}`);
    await messageInput.press('Enter');

    // Channel should be removed from sidebar
    await expect(channelNav.getByRole('button', { name: `#cmd-part-test-${tag}`, exact: true })).not.toBeVisible({ timeout: 15_000 });
  });

  test('/msg sends private message', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/msg cmdbot-${tag} Hello from command!`);
    await messageInput.press('Enter');

    // A DM tab should appear for cmdbot
    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: `cmdbot-${tag}` })).toBeVisible({ timeout: 10_000 });

    // Click on it to verify the message
    await channelNav.getByRole('button', { name: `cmdbot-${tag}` }).click();
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from command!')).toBeVisible({ timeout: 10_000 });
  });

  test('text typed in Status stays in the input, and Status says it takes commands', async () => {
    await page.getByRole('button', { name: 'Status', exact: true }).click();
    const messageInput = page.locator('#message-input');

    await messageInput.fill('join #somewhere');
    await messageInput.press('Enter');

    await expect(page.getByTestId('chat-log').getByText('Status takes no messages')).toBeVisible();
    await expect(messageInput).toHaveValue('join #somewhere');
  });

  test('a command the server refuses with FAIL shows why, where it was typed', async () => {
    skipWithoutIrcv3('ngircd has no standard replies');
    const messageInput = page.locator('#message-input');

    await messageInput.fill('/quote SETNAME :');
    await messageInput.press('Enter');

    await expect(page.getByTestId('chat-log').getByText('Realname is not valid')).toBeVisible({ timeout: 10_000 });
  });
});
