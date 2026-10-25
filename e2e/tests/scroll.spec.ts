import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, serveImagePreviews, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;
let channel: string;
let otherChannel: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);
  channel = `#scroll-test-${tag}`;
  otherChannel = `#scroll-other-${tag}`;

  bot = await createIrcClient(`scrollerbot-${tag}`);
  await bot.join(channel);
  await bot.join(otherChannel);

  await serveImagePreviews(page);
  await page.goto('/');
  await connectViaWizard(page, `scroll-tester-${tag}`, { channels: [channel, otherChannel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot.disconnect();
});

/** Enough lines to make a log scroll */
const sendLines = (target: string, label: string): void => {
  for (let i = 1; i <= 40; i++) {
    bot.sendMessage(target, `${label} ${i}`);
  }
};

const fillLog = async (label: string): Promise<void> => {
  sendLines(channel, label);
  await expect(page.getByTestId('chat-log').getByText(`${label} 40`, { exact: true })).toBeAttached({ timeout: 10_000 });
};

/** Scrolls the log to its top or bottom, and resolves once the app has had the scroll event */
const scrollLogTo = (where: 'top' | 'bottom'): Promise<void> =>
  page.getByTestId('chat-log').evaluate((log, position) => new Promise<void>((resolve) => {
    const top = position === 'top' ? 0 : log.scrollHeight - log.clientHeight;
    if (Math.abs(log.scrollTop - top) < 1) {
      resolve();
      return;
    }
    log.addEventListener('scroll', () => resolve(), { once: true });
    log.scrollTop = top;
  }), where);

const isLogAtBottom = (): Promise<boolean> =>
  page.getByTestId('chat-log').evaluate((log) => log.scrollHeight - log.scrollTop - log.clientHeight < 50);

/** Resolves after the next two frames: the log follows new content on the frame after it renders */
const nextFrames = (): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

test.describe('Scroll behavior', () => {
  test('chat auto-scrolls to bottom on new messages', async () => {
    const chatLog = page.getByTestId('chat-log');

    // Send enough messages to fill the viewport and make content scrollable
    for (let i = 1; i <= 40; i++) {
      bot.sendMessage(channel, `Autoscroll message ${i}`);
    }

    // Last message should be visible (auto-scrolled)
    await expect(chatLog.getByText('Autoscroll message 40', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Verify we're at the bottom
    expect(await isLogAtBottom()).toBe(true);
  });

  test('new messages do not auto-scroll when user scrolled up', async () => {
    await fillLog('Earlier line');
    await scrollLogTo('top');

    // Send a new message while scrolled up
    bot.sendMessage(channel, 'Message while scrolled up');
    await expect(page.getByTestId('chat-log').getByText('Message while scrolled up')).toBeAttached({ timeout: 10_000 });
    await nextFrames();

    // We should NOT be at the bottom
    expect(await isLogAtBottom()).toBe(false);
  });

  test('scrolling back to bottom resumes auto-scroll', async () => {
    const chatLog = page.getByTestId('chat-log');
    await fillLog('Earlier line');
    await scrollLogTo('top');

    await scrollLogTo('bottom');

    // Now new messages should auto-scroll again
    bot.sendMessage(channel, 'After re-scroll message');
    await expect(chatLog.getByText('After re-scroll message')).toBeVisible({ timeout: 10_000 });
    await expect.poll(isLogAtBottom).toBe(true);
  });

  test('far up, an arrow takes the user back to the newest messages', async () => {
    const chatLog = page.getByTestId('chat-log');
    const jumpButton = page.getByRole('button', { name: 'Jump to the newest messages' });
    for (let i = 1; i <= 80; i++) {
      bot.sendMessage(channel, `Long history ${i}`);
    }
    await expect(chatLog.getByText('Long history 80', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(jumpButton).toBeHidden();

    await chatLog.evaluate((el) => { el.scrollTop = 0; });
    await jumpButton.click();

    await expect(jumpButton).toBeHidden();
    await expect(chatLog.getByText('Long history 80', { exact: true })).toBeInViewport();
    bot.sendMessage(channel, 'After the jump');
    await expect(chatLog.getByText('After the jump')).toBeInViewport();
  });

  test('auto-scroll stays at bottom when async media loads after new messages', async () => {
    const chatLog = page.getByTestId('chat-log');

    // Send messages with YouTube and image links (these load async previews)
    bot.sendMessage(channel, 'Check this video https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    bot.sendMessage(channel, 'Look at this image https://simpleircclient.com/assets/test-image.png');
    bot.sendMessage(channel, 'Another video https://youtu.be/jNQXAC9IVRw');

    // Send several plain text messages after the media messages
    for (let i = 1; i <= 5; i++) {
      bot.sendMessage(channel, `Follow-up text message ${i}`);
    }

    // Wait for text messages to appear
    await expect(chatLog.getByText('Follow-up text message 5')).toBeVisible({ timeout: 10_000 });

    // Simulate a user joining (system event after media messages)
    const joiner = await createIrcClient(`scroll-joiner-${tag}`);
    await joiner.join(channel);

    // Wait for the join message to appear
    await expect(chatLog.getByText(joiner.nick)).toBeVisible({ timeout: 10_000 });

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
    expect(await isLogAtBottom()).toBe(true);

    // Clean up the joiner bot
    joiner.disconnect();
  });

  test('switching channels resets scroll to bottom', async () => {
    sendLines(otherChannel, 'Other line');
    // Sent after the other channel's lines, so they are in once these show
    await fillLog('Earlier line');
    await scrollLogTo('top');

    // Switch to the other channel
    await page.getByRole('button', { name: otherChannel, exact: true }).click();
    await expect(page.getByTestId('chat-log').getByText('Other line 40', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Should be at bottom on the new channel
    expect(await isLogAtBottom()).toBe(true);
  });

  test('switching theme keeps chat at the bottom', async () => {
    const chatLog = page.getByTestId('chat-log');
    // A tall view makes the theme's height change exceed the scrolled-up threshold
    await page.setViewportSize({ width: 1600, height: 1200 });

    for (let i = 1; i <= 60; i++) {
      bot.sendMessage(channel, i % 10 === 0 ? `Theme image ${i} https://simpleircclient.com/assets/test-image.png` : `Theme line ${i}`);
    }
    await expect(chatLog.getByText('Theme line 59', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByRole('img', { name: 'Image thumbnail' }).last()).toBeVisible({ timeout: 15_000 });

    const distanceFromBottom = () => chatLog.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

    for (const theme of ['irc', 'classic', 'modern']) {
      await openProfileSettings(page, 'appearance');
      const themeSelect = page.getByTestId('theme-select');
      await themeSelect.click();
      await page.getByTestId(`theme-${theme}`).click();
      // Radix Select restores focus only after its closing animation; Escape before that misses the Dialog
      await expect(themeSelect).toBeFocused();
      await page.keyboard.press('Escape');

      await expect.poll(distanceFromBottom, { message: `after switching to ${theme}` }).toBeLessThan(50);
    }
  });
});
