import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, serveImagePreviews } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('scrollbot');
  await bot.join('#scroll-test');
  await bot.join('#scroll-other');

  sharedPage = await browser.newPage();
  await serveImagePreviews(sharedPage);
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

    // Send enough messages to fill the viewport and make content scrollable
    for (let i = 1; i <= 40; i++) {
      bot.sendMessage('#scroll-test', `Autoscroll message ${i}`);
    }

    // Last message should be visible (auto-scrolled)
    await expect(chatLog.getByText('Autoscroll message 40', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Verify we're at the bottom
    const isAtBottom = await chatLog.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    });
    expect(isAtBottom).toBe(true);
  });

  test('new messages do not auto-scroll when user scrolled up', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Scroll to top and wait for the browser's scroll event to fire,
    // which React's onScroll handler picks up to mark user as scrolled up
    await chatLog.evaluate((el) => new Promise<void>((resolve) => {
      el.addEventListener('scroll', () => resolve(), { once: true });
      el.scrollTop = 0;
      // Fallback in case no scroll event fires (content not tall enough)
      setTimeout(() => resolve(), 500);
    }));

    // Send a new message while scrolled up
    bot.sendMessage('#scroll-test', 'Message while scrolled up');
    await sharedPage.waitForTimeout(2000);

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

  test('auto-scroll stays at bottom when async media loads after new messages', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Ensure we start at the bottom
    await chatLog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await sharedPage.waitForTimeout(200);

    // Send messages with YouTube and image links (these load async previews)
    bot.sendMessage('#scroll-test', 'Check this video https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    bot.sendMessage('#scroll-test', 'Look at this image https://simpleircclient.com/assets/test-image.png');
    bot.sendMessage('#scroll-test', 'Another video https://youtu.be/jNQXAC9IVRw');

    // Send several plain text messages after the media messages
    for (let i = 1; i <= 5; i++) {
      bot.sendMessage('#scroll-test', `Follow-up text message ${i}`);
    }

    // Wait for text messages to appear
    await expect(chatLog.getByText('Follow-up text message 5')).toBeVisible({ timeout: 10_000 });

    // Simulate a user joining (system event after media messages)
    const joiner = await createIrcClient('scroll-joiner');
    await joiner.join('#scroll-test');

    // Wait for the join message to appear
    await expect(chatLog.getByText(/scroll-joiner/)).toBeVisible({ timeout: 10_000 });

    // Wait for async media previews to load (YouTube thumbnails, image previews)
    await expect(chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(chatLog.getByRole('img', { name: 'Image thumbnail' }).first()).toBeVisible({ timeout: 15_000 });

    // Previews are visible before their images finish loading; the ResizeObserver scrolls
    // on the frame after each load, so wait for every image and one more layout
    await chatLog.evaluate(async (el) => {
      const pending = [...el.querySelectorAll('img')].filter((img) => !img.complete);
      await Promise.all(pending.map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    // After all async content has loaded, we should still be at the bottom
    // This is the key assertion: the ResizeObserver should keep us scrolled down
    // even though images loaded after the join message was already rendered
    const isAtBottom = await chatLog.evaluate((el) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    });
    expect(isAtBottom).toBe(true);

    // Clean up the joiner bot
    joiner.disconnect();
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

  test('switching theme keeps chat at the bottom', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');
    // A tall view makes the theme's height change exceed the scrolled-up threshold
    await sharedPage.setViewportSize({ width: 1600, height: 1200 });

    for (let i = 1; i <= 60; i++) {
      bot.sendMessage('#scroll-test', i % 10 === 0 ? `Theme image ${i} https://simpleircclient.com/assets/test-image.png` : `Theme line ${i}`);
    }
    await expect(chatLog.getByText('Theme line 59', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByRole('img', { name: 'Image thumbnail' }).last()).toBeVisible({ timeout: 15_000 });

    const distanceFromBottom = () => chatLog.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

    for (const theme of ['irc', 'classic', 'modern']) {
      await sharedPage.locator('[data-avatar-button]').click();
      await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
      const themeSelect = sharedPage.getByTestId('theme-select');
      await themeSelect.click();
      await sharedPage.getByTestId(`theme-${theme}`).click();
      // Radix Select restores focus only after its closing animation; Escape before that misses the Dialog
      await expect(themeSelect).toBeFocused();
      await sharedPage.keyboard.press('Escape');

      await expect.poll(distanceFromBottom, { message: `after switching to ${theme}` }).toBeLessThan(50);
    }
  });
});
