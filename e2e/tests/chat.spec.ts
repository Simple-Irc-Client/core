import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let alice: IrcClient;
let bob: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  // Alice joins both channels
  alice = await createIrcClient('alice');
  await alice.join('#general');
  await alice.join('#random');
  await alice.setTopic('#general', 'General discussion channel');
  await alice.setTopic('#random', 'Random off-topic chat');

  // Bob joins only #general
  bob = await createIrcClient('bob');
  await bob.join('#general');

  // Send messages to create channel history
  alice.sendMessage('#general', 'Hello from alice in general!');
  bob.sendMessage('#general', 'Hey alice, bob here in general!');
  alice.sendMessage('#random', 'Alice talking in random channel');

  // Small delay to ensure messages are processed by ergo
  await new Promise((r) => setTimeout(r, 500));

  // Create shared page and connect once
  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'chat-tester', { channels: ['#general', '#random'] });
});

test.afterAll(async () => {
  await sharedPage.close();
  alice.disconnect();
  bob.disconnect();
});

test.describe('Chat', () => {
  test.describe.configure({ mode: 'serial' });

  test('connects and renders main layout', async () => {
    // Verify main layout elements
    await expect(sharedPage.getByTestId('channels-sidebar')).toBeVisible();
    await expect(sharedPage.locator('#message-input')).toBeVisible();
    await expect(sharedPage.getByTestId('users-sidebar')).toBeVisible();

    // Verify both channels appear in sidebar
    await expect(sharedPage.getByRole('button', { name: '#general', exact: true })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: '#random', exact: true })).toBeVisible();
  });

  test('shows different topics when switching channels', async () => {
    // Click #general - verify its topic
    await sharedPage.getByRole('button', { name: '#general', exact: true }).click();
    await expect(sharedPage.getByTestId('topic-display')).toHaveText('General discussion channel');

    // Switch to #random - verify different topic
    await sharedPage.getByRole('button', { name: '#random', exact: true }).click();
    await expect(sharedPage.getByTestId('topic-display')).toHaveText('Random off-topic chat');

    // Switch back to #general - topic should still be correct
    await sharedPage.getByRole('button', { name: '#general', exact: true }).click();
    await expect(sharedPage.getByTestId('topic-display')).toHaveText('General discussion channel');
  });

  test('shows different messages per channel', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Switch to #general - should have messages from alice and bob
    await sharedPage.getByRole('button', { name: '#general', exact: true }).click();
    await expect(chatLog.getByText('Hello from alice in general!')).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText('Hey alice, bob here in general!')).toBeVisible();

    // Switch to #random - should have only alice's message
    await sharedPage.getByRole('button', { name: '#random', exact: true }).click();
    await expect(chatLog.getByText('Alice talking in random channel')).toBeVisible({ timeout: 10_000 });

    // Bob's message should NOT be in #random
    await expect(chatLog.getByText('bob here in general')).not.toBeVisible();
  });

  test('shows different users per channel', async () => {
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Switch to #general - should show alice, bob, and the test user
    await sharedPage.getByRole('button', { name: '#general', exact: true }).click();
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText('bob')).toBeVisible();

    // Switch to #random - should show alice but NOT bob
    await sharedPage.getByRole('button', { name: '#random', exact: true }).click();
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText('bob')).not.toBeVisible();
  });

  test('can send a message', async () => {
    // Switch to #general
    await sharedPage.getByRole('button', { name: '#general', exact: true }).click();

    const messageInput = sharedPage.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    // Type and send a message
    await messageInput.fill('Hello from Playwright!');
    await sharedPage.getByRole('button', { name: 'Send' }).click();

    // Verify the message appears in the chat log
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from Playwright!')).toBeVisible({ timeout: 10_000 });

    // Input should be cleared after sending
    await expect(messageInput).toHaveValue('');
  });

  test('can send a message with Enter key', async () => {
    await sharedPage.getByRole('button', { name: '#general', exact: true }).click();

    const messageInput = sharedPage.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    await messageInput.fill('Sent with Enter key!');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Sent with Enter key!')).toBeVisible({ timeout: 10_000 });
  });
});
