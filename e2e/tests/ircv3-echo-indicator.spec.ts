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

  skipWithoutIrcv3('the indicator marks messages the server echoed with echo-message');
  bot = await createIrcClient(`echobot-${tag}`);
  await bot.join(`#echo-test-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `echo-tester-${tag}`, { channels: [`#echo-test-${tag}`] });
  await page.getByRole('button', { name: `#echo-test-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Echo indicator', () => {
  test('sent message shows echo indicator', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill('Echo test message');
    await messageInput.press('Enter');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Echo test message')).toBeVisible({ timeout: 10_000 });

    // The echo indicator (double checkmark) should appear next to the sent message
    await expect(chatLog.locator('.lucide-check-check').first()).toBeVisible({ timeout: 10_000 });
  });

  test('received message does not show echo indicator', async () => {
    // Bot sends a message — it should NOT have the echo indicator for us
    bot.sendMessage(`#echo-test-${tag}`, 'Message from bot');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Message from bot')).toBeVisible({ timeout: 10_000 });

    const messageRow = chatLog.getByText('Message from bot').locator('..');
    await expect(messageRow.locator('.lucide-check-check')).not.toBeVisible();
  });

  test('multiple sent messages each show echo indicator', async () => {
    const messageInput = page.locator('#message-input');

    await messageInput.fill('First echo');
    await messageInput.press('Enter');
    await messageInput.fill('Second echo');
    await messageInput.press('Enter');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Second echo')).toBeVisible({ timeout: 10_000 });

    // Each sent message should have its own echo indicator
    for (const text of ['First echo', 'Second echo']) {
      // The theme shows one of the message's time slots, the indicator with it
      await expect(chatLog.locator('.sic-msg', { hasText: text }).locator('.lucide-check-check').filter({ visible: true })).toHaveCount(1, { timeout: 10_000 });
    }
  });
});
