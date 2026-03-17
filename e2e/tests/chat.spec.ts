import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let alice: IrcClient;
let bob: IrcClient;

test.beforeAll(async () => {
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
});

test.afterAll(() => {
  alice.disconnect();
  bob.disconnect();
});

test.describe('Chat', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: ReturnType<typeof test['info']> extends never ? never : never;

  test('connects and renders main layout', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'e2e-tester', { channels: ['#general', '#random'] });

    // Verify main layout elements
    await expect(page.getByRole('navigation', { name: 'Channels' })).toBeVisible();
    await expect(page.locator('#message-input')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Users' })).toBeVisible();

    // Verify both channels appear in sidebar
    await expect(page.getByRole('button', { name: '#general' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#random' })).toBeVisible();
  });

  test('shows different topics when switching channels', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'topic-tester', { channels: ['#general', '#random'] });

    // Click #general - verify its topic
    await page.getByRole('button', { name: '#general' }).click();
    await expect(page.getByLabel('topic-input')).toHaveValue('General discussion channel');

    // Switch to #random - verify different topic
    await page.getByRole('button', { name: '#random' }).click();
    await expect(page.getByLabel('topic-input')).toHaveValue('Random off-topic chat');

    // Switch back to #general - topic should still be correct
    await page.getByRole('button', { name: '#general' }).click();
    await expect(page.getByLabel('topic-input')).toHaveValue('General discussion channel');
  });

  test('shows different messages per channel', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'msg-tester', { channels: ['#general', '#random'] });

    const chatLog = page.getByRole('log');

    // Switch to #general - should have messages from alice and bob
    await page.getByRole('button', { name: '#general' }).click();
    await expect(chatLog.getByText('Hello from alice in general!')).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText('Hey alice, bob here in general!')).toBeVisible();

    // Switch to #random - should have only alice's message
    await page.getByRole('button', { name: '#random' }).click();
    await expect(chatLog.getByText('Alice talking in random channel')).toBeVisible({ timeout: 10_000 });

    // Bob's message should NOT be in #random
    await expect(chatLog.getByText('bob here in general')).not.toBeVisible();
  });

  test('shows different users per channel', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'user-tester', { channels: ['#general', '#random'] });

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });

    // Switch to #general - should show alice, bob, and the test user
    await page.getByRole('button', { name: '#general' }).click();
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText('bob')).toBeVisible();

    // Switch to #random - should show alice but NOT bob
    await page.getByRole('button', { name: '#random' }).click();
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });
    await expect(usersSidebar.getByText('bob')).not.toBeVisible();
  });

  test('can send a message', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'sender-tester', { channels: ['#general'] });

    // Switch to #general
    await page.getByRole('button', { name: '#general' }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    // Type and send a message
    await messageInput.fill('Hello from Playwright!');
    await page.getByRole('button', { name: 'Send' }).click();

    // Verify the message appears in the chat log
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('Hello from Playwright!')).toBeVisible({ timeout: 10_000 });

    // Input should be cleared after sending
    await expect(messageInput).toHaveValue('');
  });

  test('can send a message with Enter key', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'enter-tester', { channels: ['#general'] });

    await page.getByRole('button', { name: '#general' }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    await messageInput.fill('Sent with Enter key!');
    await messageInput.press('Enter');

    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText('Sent with Enter key!')).toBeVisible({ timeout: 10_000 });
  });
});
