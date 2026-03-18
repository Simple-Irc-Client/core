import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('previewbot');
  await bot.join('#previews');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'preview-tester', { channels: ['#previews'] });
  await sharedPage.getByRole('button', { name: '#previews' }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('YouTube preview', () => {
  test('YouTube link renders thumbnail preview', async () => {
    // Bot sends a message with a YouTube link
    bot.sendMessage('#previews', 'Check this out https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Check this out')).toBeVisible({ timeout: 10_000 });

    // YouTube thumbnail should be rendered
    const thumbnail = chatLog.getByRole('img', { name: 'YouTube video thumbnail' });
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });

    // Link should point to the YouTube video
    const link = chatLog.getByRole('link', { name: /watch youtube/i });
    await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('youtu.be short link renders thumbnail preview', async () => {
    bot.sendMessage('#previews', 'Short link https://youtu.be/dQw4w9WgXcQ');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Short link')).toBeVisible({ timeout: 10_000 });

    // Thumbnail should appear for the short URL too
    await expect(chatLog.getByRole('img', { name: 'YouTube video thumbnail' })).toBeVisible({ timeout: 10_000 });
  });

  test('message without YouTube link has no thumbnail', async () => {
    bot.sendMessage('#previews', 'Just a normal message, no links here');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Just a normal message')).toBeVisible({ timeout: 10_000 });

    // No thumbnail should exist
    await expect(chatLog.getByRole('img', { name: 'YouTube video thumbnail' })).not.toBeVisible();
  });
});

test.describe('Image preview', () => {
  test('image link renders inline preview', async () => {
    // Bot sends a message with an HTTPS image link (must be non-private host)
    bot.sendMessage('#previews', 'Look at this https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Look at this')).toBeVisible({ timeout: 10_000 });

    // Image preview should be rendered
    const preview = chatLog.getByRole('img', { name: 'Image thumbnail' });
    await expect(preview).toBeVisible({ timeout: 10_000 });

    // Link should open image in new tab
    const link = chatLog.getByRole('link', { name: /open image/i });
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('multiple image links render multiple previews', async () => {
    bot.sendMessage('#previews', 'Two images https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Two images')).toBeVisible({ timeout: 10_000 });

    // Both image previews should be rendered
    const previews = chatLog.getByRole('img', { name: 'Image thumbnail' });
    await expect(previews).toHaveCount(2, { timeout: 10_000 });
  });

  test('non-image link does not render image preview', async () => {
    bot.sendMessage('#previews', 'Visit https://example.com/page.html');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Visit')).toBeVisible({ timeout: 10_000 });

    // No image preview should exist
    await expect(chatLog.getByRole('img', { name: 'Image thumbnail' })).not.toBeVisible();
  });
});

test.describe('Social embed preview', () => {
  test('Twitter/X link renders embed iframe', async () => {
    bot.sendMessage('#previews', 'Check this tweet https://x.com/user/status/1234567890123456789');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Check this tweet')).toBeVisible({ timeout: 10_000 });

    // Social embed iframe should be rendered
    const iframe = chatLog.locator('iframe[title="View social media post"]');
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    // iframe src should point to Twitter embed
    await expect(iframe).toHaveAttribute('src', /platform\.twitter\.com\/embed\/Tweet\.html\?id=1234567890123456789/);

    // iframe should be sandboxed
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  });

  test('Bluesky link renders embed iframe', async () => {
    bot.sendMessage('#previews', 'Bluesky post https://bsky.app/profile/user.bsky.social/post/3abc123def');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Bluesky post')).toBeVisible({ timeout: 10_000 });

    // Embed iframe should appear
    const iframe = chatLog.locator('iframe[title="View social media post"]');
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    // iframe src should point to Bluesky embed
    await expect(iframe).toHaveAttribute('src', /embed\.bsky\.app\/embed\/user\.bsky\.social\/app\.bsky\.feed\.post\/3abc123def/);
  });

  test('Facebook link renders embed iframe', async () => {
    bot.sendMessage('#previews', 'FB post https://www.facebook.com/user/posts/123456789');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('FB post')).toBeVisible({ timeout: 10_000 });

    // Embed iframe should appear
    const iframe = chatLog.locator('iframe[title="View social media post"]');
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    // iframe src should point to Facebook embed
    await expect(iframe).toHaveAttribute('src', /facebook\.com\/plugins\/post\.php/);
  });

  test('non-social link does not render embed', async () => {
    bot.sendMessage('#previews', 'Regular link https://example.com/article');

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Regular link')).toBeVisible({ timeout: 10_000 });

    // No embed iframe should exist
    await expect(chatLog.locator('iframe[title="View social media post"]')).not.toBeVisible();
  });
});
