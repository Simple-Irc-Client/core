import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

/** The time the page's clock was set to, once a test sets it */
let shiftedNow: number | undefined;

/** Server-time tags follow the page's clock once it is set, as though the server's clock had been set with it */
const shiftServerTimes = (target: Page): Promise<void> =>
  target.routeWebSocket(/.*/, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      socket.send(typeof message === 'string' && shiftedNow !== undefined
        ? message.replace(/(^@|;)time=[^; ]+/g, `$1time=${new Date(shiftedNow).toISOString()}`)
        : message);
    });
  });

/** Sets the page's clock to `fromMidnight` ms from the coming midnight */
const setClockAroundMidnight = async (fromMidnight: number): Promise<void> => {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  shiftedNow = midnight.getTime() + fromMidnight;
  await page.clock.setSystemTime(shiftedNow);
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);
  shiftedNow = undefined;

  bot = await createIrcClient(`datebot-${tag}`);
  await bot.join(`#date-sep-${tag}`);

  await page.clock.install();
  await shiftServerTimes(page);
  await page.goto('/');
  await connectViaWizard(page, `date-tester-${tag}`, { channels: [`#date-sep-${tag}`] });
  await page.getByRole('button', { name: `#date-sep-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot.disconnect();
});

/** The bot says one thing 5s before midnight and another 2s after it */
const messagesEitherSideOfMidnight = async (): Promise<void> => {
  const chatLog = page.getByTestId('chat-log');
  await setClockAroundMidnight(-5000);
  bot.sendMessage(`#date-sep-${tag}`, 'Before midnight message');
  await expect(chatLog.getByText('Before midnight message')).toBeVisible({ timeout: 10_000 });

  await setClockAroundMidnight(2000);
  bot.sendMessage(`#date-sep-${tag}`, 'After midnight message');
  await expect(chatLog.getByText('After midnight message')).toBeVisible({ timeout: 10_000 });
};

test.describe('Date separator', () => {
  test('no separator between messages from the same day', async () => {
    // Send two messages on the same day
    bot.sendMessage(`#date-sep-${tag}`, 'Same day message 1');
    bot.sendMessage(`#date-sep-${tag}`, 'Same day message 2');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Same day message 1')).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText('Same day message 2')).toBeVisible({ timeout: 10_000 });

    // No date separator should exist between same-day messages
    await expect(chatLog.locator('[role="separator"]')).not.toBeVisible();
  });

  test('separator appears between messages from different days', async () => {
    const chatLog = page.getByTestId('chat-log');

    await messagesEitherSideOfMidnight();

    // A date separator should now appear between the two days
    await expect(chatLog.locator('[role="separator"]')).toBeVisible({ timeout: 10_000 });
  });

  test('separator shows formatted date text', async () => {
    const chatLog = page.getByTestId('chat-log');
    await messagesEitherSideOfMidnight();

    // The separator should contain a human-readable date
    const separator = chatLog.locator('[role="separator"]');
    await expect(separator).toBeVisible({ timeout: 10_000 });
    const text = await separator.first().textContent();

    // date-fns 'PPP' format produces e.g. "March 18th, 2026" or locale equivalent
    // Just verify it contains non-empty date text
    expect(text).toBeTruthy();
    expect((text ?? '').trim().length).toBeGreaterThan(0);
  });
});
