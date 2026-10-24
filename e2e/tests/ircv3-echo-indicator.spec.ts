import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let sharedPage: Page;
let tag: string;

test.beforeAll(async ({ browser }, testInfo) => {
  // Each browser project runs this at once on the same server: names of its own keep them apart
  tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';

  skipWithoutIrcv3('the indicator marks messages the server echoed with echo-message');
  bot = await createIrcClient(`echobot-${tag}`);
  await bot.join(`#echo-test-${tag}`);

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, `echo-tester-${tag}`, { channels: [`#echo-test-${tag}`] });
  await sharedPage.getByRole('button', { name: `#echo-test-${tag}`, exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage?.close();
  bot?.disconnect();
});

test.describe('Echo indicator', () => {
  test.describe.configure({ mode: 'serial' });

  test('sent message shows echo indicator', async () => {
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('Echo test message');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Echo test message')).toBeVisible({ timeout: 10_000 });

    // The echo indicator (double checkmark) should appear next to the sent message
    await expect(chatLog.locator('.lucide-check-check').first()).toBeVisible({ timeout: 10_000 });
  });

  test('received message does not show echo indicator', async () => {
    // Bot sends a message — it should NOT have the echo indicator for us
    bot.sendMessage(`#echo-test-${tag}`, 'Message from bot');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Message from bot')).toBeVisible({ timeout: 10_000 });

    // Count echo indicators — only the one from previous test should exist
    const messageRow = chatLog.getByText('Message from bot').locator('..');
    await expect(messageRow.locator('.lucide-check-check')).not.toBeVisible();
  });

  test('multiple sent messages each show echo indicator', async () => {
    const messageInput = sharedPage.locator('#message-input');

    await messageInput.fill('First echo');
    await messageInput.press('Enter');
    await messageInput.fill('Second echo');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Second echo')).toBeVisible({ timeout: 10_000 });

    // Each sent message should have its own echo indicator
    const echoIndicators = chatLog.locator('.lucide-check-check');
    const count = await echoIndicators.count();
    // At least 3 (one from test 1 + two from this test)
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
