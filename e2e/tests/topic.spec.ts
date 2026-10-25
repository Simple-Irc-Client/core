import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let tag: string;

test.beforeEach(async ({}, testInfo) => {
  tag = testTag(testInfo);

  // Bot creates and owns #bot-topic-chan (gets ops as first joiner)
  bot = await createIrcClient(`topicbot-${tag}`);
  await bot.join(`#bot-topic-chan-${tag}`);
  await bot.setTopic(`#bot-topic-chan-${tag}`, 'Bot-controlled topic');
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Topic', () => {
  test('edit topic as channel operator', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, `topic-op-${tag}`);

    // Create a new channel where this user will be the first joiner (gets ops)
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/join #my-topic-chan-${tag}`);
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: `#my-topic-chan-${tag}`, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: `#my-topic-chan-${tag}`, exact: true }).click();

    // As op, the topic input should be an editable input field
    const topicInput = page.getByTestId('topic-input');
    await expect(topicInput).toBeVisible({ timeout: 5_000 });

    // Set a topic
    await topicInput.fill('My new topic');
    await topicInput.press('Enter');

    // Topic change message should appear in chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(/has changed the topic to/)).toBeVisible({ timeout: 10_000 });

    // Topic input should reflect the new value
    await expect(topicInput).toHaveValue('My new topic');
  });

  test('topic is read-only without ops', async ({ page }) => {
    await page.goto('/');
    // Join bot's channel where user won't have ops
    await connectViaWizard(page, `topic-noops-${tag}`, { channels: [`#bot-topic-chan-${tag}`] });

    await page.getByRole('button', { name: `#bot-topic-chan-${tag}`, exact: true }).click();

    // The topic text should be visible in the read-only display
    await expect(page.getByTestId('topic-display')).toHaveText('Bot-controlled topic', { timeout: 10_000 });

    // Once the members are known, the topic input should NOT be present (non-ops see read-only div, not an input)
    await expect(page.getByTestId('users-sidebar').getByText(bot.nick)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('topic-input')).toHaveCount(0);
  });
});
