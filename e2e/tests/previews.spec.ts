import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, expectImageLoaded, serveImagePreviews, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`previewbot-${tag}`);
  await bot.join(`#previews-${tag}`);

  await serveImagePreviews(page);
  await page.goto('/');
  await connectViaWizard(page, `preview-tester-${tag}`, { channels: [`#previews-${tag}`] });
  await page.getByRole('button', { name: `#previews-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Previews', () => {
  test('YouTube link renders thumbnail preview', async () => {
    bot.sendMessage(`#previews-${tag}`, 'Check this out https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Check this out')).toBeVisible({ timeout: 10_000 });

    const thumbnail = chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).last();
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });

    const link = chatLog.getByRole('link', { name: /watch youtube/i }).last();
    await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('youtu.be short link renders thumbnail preview', async () => {
    bot.sendMessage(`#previews-${tag}`, 'Short link https://youtu.be/dQw4w9WgXcQ');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Short link')).toBeVisible({ timeout: 10_000 });

    await expect(chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).last()).toBeVisible({ timeout: 10_000 });
  });

  test('message without YouTube link has no thumbnail', async () => {
    const chatLog = page.getByTestId('chat-log');

    const countBefore = await chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).count();

    bot.sendMessage(`#previews-${tag}`, 'Just a normal message, no links here');
    await expect(chatLog.getByText('Just a normal message')).toBeVisible({ timeout: 10_000 });

    const countAfter = await chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).count();
    expect(countAfter).toBe(countBefore);
  });

  test('image link renders inline preview', async () => {
    bot.sendMessage(`#previews-${tag}`, 'Look at this https://simpleircclient.com/assets/test-image.png');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Look at this')).toBeVisible({ timeout: 10_000 });

    // Not just the <img> tag existing: the image itself loaded
    await expectImageLoaded(chatLog.getByRole('img', { name: 'Image thumbnail' }).last());

    const link = chatLog.getByRole('link', { name: /open image/i }).last();
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('multiple image links render multiple previews', async () => {
    const chatLog = page.getByTestId('chat-log');

    const countBefore = await chatLog.getByRole('img', { name: 'Image thumbnail' }).count();

    bot.sendMessage(`#previews-${tag}`, 'Two images https://simpleircclient.com/assets/test-image.jpg https://simpleircclient.com/assets/test-image.png');
    await expect(chatLog.getByText('Two images')).toBeVisible({ timeout: 10_000 });

    const previews = chatLog.getByRole('img', { name: 'Image thumbnail' });
    await expect(previews).toHaveCount(countBefore + 2, { timeout: 10_000 });
    for (const preview of await previews.all()) {
      await expectImageLoaded(preview);
    }
  });

  test('webp image link renders inline preview', async () => {
    bot.sendMessage(`#previews-${tag}`, 'WebP test https://simpleircclient.com/assets/test-image.webp');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('WebP test')).toBeVisible({ timeout: 10_000 });

    await expectImageLoaded(chatLog.getByRole('img', { name: 'Image thumbnail' }).last());

    const link = chatLog.getByRole('link', { name: /open image/i }).last();
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('non-image link does not render image preview', async () => {
    const chatLog = page.getByTestId('chat-log');

    const countBefore = await chatLog.getByRole('img', { name: 'Image thumbnail' }).count();

    bot.sendMessage(`#previews-${tag}`, 'Visit https://example.com/page.html');
    await expect(chatLog.getByText('Visit')).toBeVisible({ timeout: 10_000 });

    const countAfter = await chatLog.getByRole('img', { name: 'Image thumbnail' }).count();
    expect(countAfter).toBe(countBefore);
  });

  test('Twitter/X link renders embed iframe', async () => {
    bot.sendMessage(`#previews-${tag}`, 'Check this tweet https://x.com/user/status/1234567890123456789');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Check this tweet')).toBeVisible({ timeout: 10_000 });

    const iframe = chatLog.locator('iframe[title="View social media post"]').last();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    await expect(iframe).toHaveAttribute('src', /platform\.twitter\.com\/embed\/Tweet\.html\?id=1234567890123456789/);

    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  });

  test('Bluesky link renders embed iframe', async () => {
    bot.sendMessage(`#previews-${tag}`, 'Bluesky post https://bsky.app/profile/user.bsky.social/post/3abc123def');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Bluesky post')).toBeVisible({ timeout: 10_000 });

    const iframe = chatLog.locator('iframe[title="View social media post"]').last();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    await expect(iframe).toHaveAttribute('src', /embed\.bsky\.app\/embed\/user\.bsky\.social\/app\.bsky\.feed\.post\/3abc123def/);
  });

  test('Facebook link renders embed iframe', async () => {
    bot.sendMessage(`#previews-${tag}`, 'FB post https://www.facebook.com/user/posts/123456789');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('FB post')).toBeVisible({ timeout: 10_000 });

    const iframe = chatLog.locator('iframe[title="View social media post"]').last();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    await expect(iframe).toHaveAttribute('src', /facebook\.com\/plugins\/post\.php/);
  });

  test('non-social link does not render embed', async () => {
    const chatLog = page.getByTestId('chat-log');

    const countBefore = await chatLog.locator('iframe[title="View social media post"]').count();

    bot.sendMessage(`#previews-${tag}`, 'Regular link https://example.com/article');
    await expect(chatLog.getByText('Regular link')).toBeVisible({ timeout: 10_000 });

    const countAfter = await chatLog.locator('iframe[title="View social media post"]').count();
    expect(countAfter).toBe(countBefore);
  });
});
