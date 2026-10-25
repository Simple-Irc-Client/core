import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, waitForPersistedChannels, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`dmbot-${tag}`);
  await bot.join(`#dm-test-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `dm-tester-${tag}`, { channels: [`#dm-test-${tag}`] });
  await page.getByRole('button', { name: `#dm-test-${tag}`, exact: true }).click();
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Private messages', () => {
  test('receiving a DM creates a new tab in channel sidebar', async () => {
    const channelNav = page.getByTestId('channels-sidebar');

    // Bot sends a private message to the test user
    bot.sendMessage(`dm-tester-${tag}`, 'Hello from DM bot!');

    // A new tab for the bot should appear in the sidebar
    await expect(channelNav.getByRole('button', { name: `dmbot-${tag}` })).toBeVisible({ timeout: 10_000 });

    // Click on the DM tab
    await channelNav.getByRole('button', { name: `dmbot-${tag}` }).click();

    // The message should be visible in the chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from DM bot!')).toBeVisible({ timeout: 5_000 });
  });

  test('can reply to a DM', async () => {
    const channelNav = page.getByTestId('channels-sidebar');

    // Bot sends a DM
    bot.sendMessage(`dm-tester-${tag}`, 'Can you reply?');

    // Wait for DM tab
    await expect(channelNav.getByRole('button', { name: `dmbot-${tag}` })).toBeVisible({ timeout: 10_000 });
    await channelNav.getByRole('button', { name: `dmbot-${tag}` }).click();

    // Reply
    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 5_000 });
    await messageInput.fill('Yes, here is my reply!');
    await messageInput.press('Enter');

    // Reply should appear in chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Yes, here is my reply!')).toBeVisible({ timeout: 10_000 });
  });

  test('DM window shows both participants in the users list', async () => {
    const channelNav = page.getByTestId('channels-sidebar');

    // Bot sends a DM and we open the DM tab
    bot.sendMessage(`dm-tester-${tag}`, 'Checking the users list');
    await expect(channelNav.getByRole('button', { name: `dmbot-${tag}`, exact: true })).toBeVisible({ timeout: 10_000 });
    await channelNav.getByRole('button', { name: `dmbot-${tag}`, exact: true }).click();

    // The users sidebar should list exactly the two participants
    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByRole('button', { name: `dmbot-${tag}` })).toBeVisible({ timeout: 5_000 });
    await expect(usersSidebar.getByRole('button', { name: `dm-tester-${tag}` })).toBeVisible({ timeout: 5_000 });
  });

  test('DM messages do not appear in channel tabs', async () => {
    // Bot sends a DM
    bot.sendMessage(`dm-tester-${tag}`, 'This is a private message');

    // Wait for DM tab to appear
    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: `dmbot-${tag}` })).toBeVisible({ timeout: 10_000 });

    // Stay on #dm-test — the DM message should NOT appear in the channel chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('This is a private message')).not.toBeVisible();
  });

  test('closing the focused DM window does not leave a ghost current window', async () => {
    const channelNav = page.getByTestId('channels-sidebar');

    // Make the DM window the current one
    bot.sendMessage(`dm-tester-${tag}`, 'about to be closed');
    const dmTab = channelNav.getByRole('button', { name: `dmbot-${tag}`, exact: true });
    await expect(dmTab).toBeVisible({ timeout: 10_000 });
    await dmTab.click();
    await expect(page.locator('#message-input')).toHaveAttribute('placeholder', new RegExp(bot.nick));

    // Close the focused DM via its X button (appears on hover). The .click()
    // above already left the cursor resting on this exact tab, so hovering
    // the same coordinates again would dispatch no new mouseenter and the
    // close icon would never appear — move away first.
    await page.mouse.move(0, 0);
    await dmTab.hover();
    await channelNav.getByRole('button', { name: `Leave dmbot-${tag}` }).click();
    await expect(dmTab).not.toBeVisible();

    // The main view must not still point at the removed window
    await expect(page.locator('#message-input')).not.toHaveAttribute('placeholder', new RegExp(bot.nick));
  });

  test('DM participants survive a page reload (persisted DM window)', async () => {
    const channelNav = page.getByTestId('channels-sidebar');

    // Open the DM window and make it current
    bot.sendMessage(`dm-tester-${tag}`, 'before the reload');
    await expect(channelNav.getByRole('button', { name: `dmbot-${tag}`, exact: true })).toBeVisible({ timeout: 10_000 });
    await channelNav.getByRole('button', { name: `dmbot-${tag}`, exact: true }).click();

    await waitForPersistedChannels(page, 'before the reload');

    await page.reload();

    // The DM window is restored from persistence; its users list must still
    // show both participants even before reconnecting
    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByRole('button', { name: `dmbot-${tag}` })).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByRole('button', { name: `dm-tester-${tag}` })).toBeVisible({ timeout: 5_000 });
  });
});
