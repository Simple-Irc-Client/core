import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  // Bot creates and owns #bot-topic-chan (gets ops as first joiner)
  bot = await createIrcClient('topicbot');
  await bot.join('#bot-topic-chan');
  await bot.setTopic('#bot-topic-chan', 'Bot-controlled topic');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Topic', () => {
  test.describe.configure({ mode: 'serial' });

  test('edit topic as channel operator', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'topic-op');

    // Create a new channel where this user will be the first joiner (gets ops)
    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #my-topic-chan');
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: '#my-topic-chan' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#my-topic-chan' }).click();

    // As op, the topic input should be an editable input field
    const topicInput = page.getByLabel('topic-input');
    await expect(topicInput).toBeVisible({ timeout: 5_000 });

    // Set a topic
    await topicInput.fill('My new topic');
    await topicInput.press('Enter');

    // Topic change message should appear in chat log
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText(/has changed the topic to/)).toBeVisible({ timeout: 10_000 });

    // Topic input should reflect the new value
    await expect(topicInput).toHaveValue('My new topic');
  });

  test('topic is read-only without ops', async ({ page }) => {
    await page.goto('/');
    // Join bot's channel where user won't have ops
    await connectViaWizard(page, 'topic-noops', { channels: ['#bot-topic-chan'] });

    await page.getByRole('button', { name: '#bot-topic-chan' }).click();

    // The topic text should be visible
    await expect(page.getByText('Bot-controlled topic')).toBeVisible({ timeout: 10_000 });

    // The topic input should NOT be present (non-ops see read-only div, not an input)
    await expect(page.getByLabel('topic-input')).not.toBeVisible();
  });
});
