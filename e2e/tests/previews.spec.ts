import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

test.describe('Previews', () => {
  test.describe.configure({ mode: 'serial' });

  let bot: IrcClient;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    bot = await createIrcClient('previewbot');
    await bot.join('#previews');

    sharedPage = await browser.newPage();
    await sharedPage.goto('/');
    await connectViaWizard(sharedPage, 'preview-tester', { channels: ['#previews'] });
    await sharedPage.getByRole('button', { name: '#previews', exact: true }).click();
    await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  });

  test.afterAll(async () => {
    await sharedPage?.close();
    bot?.disconnect();
  });

  test('YouTube link renders thumbnail preview', async () => {
    bot.sendMessage('#previews', 'Check this out https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Check this out')).toBeVisible({ timeout: 10_000 });

    const thumbnail = chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).last();
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });

    const link = chatLog.getByRole('link', { name: /watch youtube/i }).last();
    await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('youtu.be short link renders thumbnail preview', async () => {
    bot.sendMessage('#previews', 'Short link https://youtu.be/dQw4w9WgXcQ');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Short link')).toBeVisible({ timeout: 10_000 });

    await expect(chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).last()).toBeVisible({ timeout: 10_000 });
  });

  test('message without YouTube link has no thumbnail', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    const countBefore = await chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).count();

    bot.sendMessage('#previews', 'Just a normal message, no links here');
    await expect(chatLog.getByText('Just a normal message')).toBeVisible({ timeout: 10_000 });

    const countAfter = await chatLog.getByRole('img', { name: 'YouTube video thumbnail' }).count();
    expect(countAfter).toBe(countBefore);
  });

  test('image link renders inline preview', async () => {
    bot.sendMessage('#previews', 'Look at this https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Look at this')).toBeVisible({ timeout: 10_000 });

    const preview = chatLog.getByRole('img', { name: 'Image thumbnail' }).last();
    await expect(preview).toBeVisible({ timeout: 10_000 });

    const link = chatLog.getByRole('link', { name: /open image/i }).last();
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('multiple image links render multiple previews', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    const countBefore = await chatLog.getByRole('img', { name: 'Image thumbnail' }).count();

    bot.sendMessage('#previews', 'Two images https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg');
    await expect(chatLog.getByText('Two images')).toBeVisible({ timeout: 10_000 });

    const previews = chatLog.getByRole('img', { name: 'Image thumbnail' });
    await expect(previews).toHaveCount(countBefore + 2, { timeout: 10_000 });
  });

  test('non-image link does not render image preview', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    const countBefore = await chatLog.getByRole('img', { name: 'Image thumbnail' }).count();

    bot.sendMessage('#previews', 'Visit https://example.com/page.html');
    await expect(chatLog.getByText('Visit')).toBeVisible({ timeout: 10_000 });

    const countAfter = await chatLog.getByRole('img', { name: 'Image thumbnail' }).count();
    expect(countAfter).toBe(countBefore);
  });

  test('Twitter/X link renders embed iframe', async () => {
    bot.sendMessage('#previews', 'Check this tweet https://x.com/user/status/1234567890123456789');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Check this tweet')).toBeVisible({ timeout: 10_000 });

    const iframe = chatLog.locator('iframe[title="View social media post"]').last();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    await expect(iframe).toHaveAttribute('src', /platform\.twitter\.com\/embed\/Tweet\.html\?id=1234567890123456789/);

    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  });

  test('Bluesky link renders embed iframe', async () => {
    bot.sendMessage('#previews', 'Bluesky post https://bsky.app/profile/user.bsky.social/post/3abc123def');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Bluesky post')).toBeVisible({ timeout: 10_000 });

    const iframe = chatLog.locator('iframe[title="View social media post"]').last();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    await expect(iframe).toHaveAttribute('src', /embed\.bsky\.app\/embed\/user\.bsky\.social\/app\.bsky\.feed\.post\/3abc123def/);
  });

  test('Facebook link renders embed iframe', async () => {
    bot.sendMessage('#previews', 'FB post https://www.facebook.com/user/posts/123456789');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('FB post')).toBeVisible({ timeout: 10_000 });

    const iframe = chatLog.locator('iframe[title="View social media post"]').last();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    await expect(iframe).toHaveAttribute('src', /facebook\.com\/plugins\/post\.php/);
  });

  test('non-social link does not render embed', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    const countBefore = await chatLog.locator('iframe[title="View social media post"]').count();

    bot.sendMessage('#previews', 'Regular link https://example.com/article');
    await expect(chatLog.getByText('Regular link')).toBeVisible({ timeout: 10_000 });

    const countAfter = await chatLog.locator('iframe[title="View social media post"]').count();
    expect(countAfter).toBe(countBefore);
  });
});
