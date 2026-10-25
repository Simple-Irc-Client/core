import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let alice: IrcClient;
let bob: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  // Alice joins both channels
  alice = await createIrcClient(`alice-${tag}`);
  await alice.join(`#general-${tag}`);
  await alice.join(`#random-${tag}`);
  await alice.setTopic(`#general-${tag}`, 'General discussion channel');
  await alice.setTopic(`#random-${tag}`, 'Random off-topic chat');

  // Bob joins only #general
  bob = await createIrcClient(`bob-${tag}`);
  await bob.join(`#general-${tag}`);

  // Send messages to create channel history
  alice.sendMessage(`#general-${tag}`, `Hello from alice-${tag} in general!`);
  bob.sendMessage(`#general-${tag}`, `Hey alice-${tag}, bob-${tag} here in general!`);
  alice.sendMessage(`#random-${tag}`, 'Alice talking in random channel');

  // In the channels' history before the app joins
  await alice.roundTrip();
  await bob.roundTrip();

  await page.goto('/');
  await connectViaWizard(page, `chat-tester-${tag}`, { channels: [`#general-${tag}`, `#random-${tag}`] });
});

test.afterEach(() => {
  alice.disconnect();
  bob.disconnect();
});

test.describe('Chat', () => {
  test('connects and renders main layout', async () => {
    // Verify main layout elements
    await expect(page.getByTestId('channels-sidebar')).toBeVisible();
    await expect(page.locator('#message-input')).toBeVisible();
    await expect(page.getByTestId('users-sidebar')).toBeVisible();

    // Verify both channels appear in sidebar
    await expect(page.getByRole('button', { name: `#general-${tag}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `#random-${tag}`, exact: true })).toBeVisible();
  });

  test('shows different topics when switching channels', async () => {
    // Click #general - verify its topic
    await page.getByRole('button', { name: `#general-${tag}`, exact: true }).click();
    await expect(page.getByTestId('topic-display')).toHaveText('General discussion channel');

    // Switch to #random - verify different topic
    await page.getByRole('button', { name: `#random-${tag}`, exact: true }).click();
    await expect(page.getByTestId('topic-display')).toHaveText('Random off-topic chat');

    // Switch back to #general - topic should still be correct
    await page.getByRole('button', { name: `#general-${tag}`, exact: true }).click();
    await expect(page.getByTestId('topic-display')).toHaveText('General discussion channel');
  });

  test('shows different messages per channel', async () => {
    skipWithoutIrcv3('messages sent before joining come from CHATHISTORY');
    const chatLog = page.getByTestId('chat-log');

    // Switch to #general - should have messages from alice and bob
    await page.getByRole('button', { name: `#general-${tag}`, exact: true }).click();
    await expect(chatLog.getByText(`Hello from alice-${tag} in general!`)).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText(`Hey alice-${tag}, bob-${tag} here in general!`)).toBeVisible();

    // Switch to #random - should have only alice's message
    await page.getByRole('button', { name: `#random-${tag}`, exact: true }).click();
    await expect(chatLog.getByText('Alice talking in random channel')).toBeVisible({ timeout: 10_000 });

    // Bob's message should NOT be in #random
    await expect(chatLog.getByText(`bob-${tag} here in general`)).not.toBeVisible();
  });

  test('shows different users per channel', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Switch to #general - should show alice, bob, and the test user
    await page.getByRole('button', { name: `#general-${tag}`, exact: true }).click();
    await expect(usersSidebar.getByText(`alice-${tag}`)).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText(`bob-${tag}`)).toBeVisible();

    // Switch to #random - should show alice but NOT bob
    await page.getByRole('button', { name: `#random-${tag}`, exact: true }).click();
    await expect(usersSidebar.getByText(`alice-${tag}`)).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText(`bob-${tag}`)).not.toBeVisible();
  });

  test('can send a message', async () => {
    // Switch to #general
    await page.getByRole('button', { name: `#general-${tag}`, exact: true }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    // Type and send a message
    await messageInput.fill('Hello from Playwright!');
    await page.getByRole('button', { name: 'Send' }).click();

    // Verify the message appears in the chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from Playwright!')).toBeVisible({ timeout: 10_000 });

    // Input should be cleared after sending
    await expect(messageInput).toHaveValue('');
  });

  test('can send a message with Enter key', async () => {
    await page.getByRole('button', { name: `#general-${tag}`, exact: true }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    await messageInput.fill('Sent with Enter key!');
    await messageInput.press('Enter');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Sent with Enter key!')).toBeVisible({ timeout: 10_000 });
  });
});
