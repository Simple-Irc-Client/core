import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('scrollbot');
  await bot.join('#scroll-test');
  await bot.join('#scroll-other');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'scroll-tester', { channels: ['#scroll-test', '#scroll-other'] });
  await sharedPage.getByRole('button', { name: '#scroll-test', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Scroll behavior', () => {
  test.describe.configure({ mode: 'serial' });

  test('chat auto-scrolls to bottom on new messages', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Send enough messages to fill the viewport
    for (let i = 1; i <= 20; i++) {
      bot.sendMessage('#scroll-test', `Autoscroll message ${i}`);
    }

    // Last message should be visible (auto-scrolled)
    await expect(chatLog.getByText('Autoscroll message 20')).toBeVisible({ timeout: 10_000 });

    // Verify we're at the bottom
    const isAtBottom = await chatLog.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    });
    expect(isAtBottom).toBe(true);
  });

  test('new messages do not auto-scroll when user scrolled up', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Scroll to the top
    await chatLog.evaluate((el) => { el.scrollTop = 0; });
    // Wait for scroll event to register
    await sharedPage.waitForTimeout(200);

    // Send a new message while scrolled up
    bot.sendMessage('#scroll-test', 'Message while scrolled up');
    await sharedPage.waitForTimeout(1000);

    // We should NOT be at the bottom
    const isAtBottom = await chatLog.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    });
    expect(isAtBottom).toBe(false);
  });

  test('scrolling back to bottom resumes auto-scroll', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Scroll to bottom
    await chatLog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await sharedPage.waitForTimeout(200);

    // Now new messages should auto-scroll again
    bot.sendMessage('#scroll-test', 'After re-scroll message');
    await expect(chatLog.getByText('After re-scroll message')).toBeVisible({ timeout: 10_000 });

    const isAtBottom = await chatLog.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    });
    expect(isAtBottom).toBe(true);
  });

  test('switching channels resets scroll to bottom', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Scroll to the top on current channel
    await chatLog.evaluate((el) => { el.scrollTop = 0; });
    await sharedPage.waitForTimeout(200);

    // Switch to #scroll-other
    await sharedPage.getByRole('button', { name: '#scroll-other', exact: true }).click();
    await sharedPage.waitForTimeout(500);

    // Should be at bottom on the new channel
    const isAtBottom = await chatLog.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    });
    expect(isAtBottom).toBe(true);

    // Switch back for next tests
    await sharedPage.getByRole('button', { name: '#scroll-test', exact: true }).click();
  });
});
