import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`badgebot-${tag}`);
  await bot.join(`#badge-a-${tag}`);
  await bot.join(`#badge-b-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `badge-tester-${tag}`, { channels: [`#badge-a-${tag}`, `#badge-b-${tag}`] });

  // Start on #badge-a
  await page.getByRole('button', { name: `#badge-a-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Unread badges', () => {
  test('unread badge appears on inactive channel', async () => {
    // Bot sends a message to #badge-b (inactive channel)
    bot.sendMessage(`#badge-b-${tag}`, 'Unread message!');

    // A badge should appear on the #badge-b button
    const channelNav = page.getByTestId('channels-sidebar');
    const badgeBButton = channelNav.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).locator('..');
    await expect(badgeBButton.locator('[aria-label*="unread"]')).toBeVisible({ timeout: 10_000 });
  });

  test('badge clears when switching to channel', async () => {
    // Bot sends a message to #badge-b
    bot.sendMessage(`#badge-b-${tag}`, 'Will be read soon');

    // Wait for badge to appear
    const channelNav = page.getByTestId('channels-sidebar');
    const badgeBContainer = channelNav.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).locator('..');
    await expect(badgeBContainer.locator('[aria-label*="unread"]')).toBeVisible({ timeout: 10_000 });

    // Click #badge-b to switch to it
    await page.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).click();

    // Badge should disappear
    await expect(badgeBContainer.locator('[aria-label*="unread"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('mention badge has destructive styling', async () => {
    // Bot sends a message mentioning the user's nick in #badge-b
    bot.sendMessage(`#badge-b-${tag}`, `Hey badge-tester-${tag}, look at this!`);

    // A badge with mention styling should appear
    const channelNav = page.getByTestId('channels-sidebar');
    const badgeBContainer = channelNav.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).locator('..');
    await expect(badgeBContainer.locator('[aria-label*="mention"]')).toBeVisible({ timeout: 10_000 });
  });
});
