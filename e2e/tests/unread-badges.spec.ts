import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;
let tag: string;

test.beforeAll(async ({ browser }, testInfo) => {
  // Each browser project runs this at once on the same server: names of its own keep them apart
  tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';

  bot = await createIrcClient(`badgebot-${tag}`);
  await bot.join(`#badge-a-${tag}`);
  await bot.join(`#badge-b-${tag}`);

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, `badge-tester-${tag}`, { channels: [`#badge-a-${tag}`, `#badge-b-${tag}`] });

  // Start on #badge-a
  await sharedPage.getByRole('button', { name: `#badge-a-${tag}`, exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Unread badges', () => {
  test.describe.configure({ mode: 'serial' });

  test('unread badge appears on inactive channel', async () => {
    // Bot sends a message to #badge-b (inactive channel)
    bot.sendMessage(`#badge-b-${tag}`, 'Unread message!');

    // A badge should appear on the #badge-b button
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    const badgeBButton = channelNav.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).locator('..');
    await expect(badgeBButton.locator('[aria-label*="unread"]')).toBeVisible({ timeout: 10_000 });
  });

  test('badge clears when switching to channel', async () => {
    // Bot sends a message to #badge-b
    bot.sendMessage(`#badge-b-${tag}`, 'Will be read soon');

    // Wait for badge to appear
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    const badgeBContainer = channelNav.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).locator('..');
    await expect(badgeBContainer.locator('[aria-label*="unread"]')).toBeVisible({ timeout: 10_000 });

    // Click #badge-b to switch to it
    await sharedPage.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).click();

    // Badge should disappear
    await expect(badgeBContainer.locator('[aria-label*="unread"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('mention badge has destructive styling', async () => {
    // Ensure we're on #badge-a (test 2 left us on #badge-b)
    await sharedPage.getByRole('button', { name: `#badge-a-${tag}`, exact: true }).click();
    await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sends a message mentioning the user's nick in #badge-b
    bot.sendMessage(`#badge-b-${tag}`, `Hey badge-tester-${tag}, look at this!`);

    // A badge with mention styling should appear
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    const badgeBContainer = channelNav.getByRole('button', { name: `#badge-b-${tag}`, exact: true }).locator('..');
    await expect(badgeBContainer.locator('[aria-label*="mention"]')).toBeVisible({ timeout: 10_000 });
  });
});
