import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let tag: string;
let channel: string;

test.beforeEach(async ({}, testInfo) => {
  tag = testTag(testInfo);
  channel = `#away-test-${tag}`;

  bot = await createIrcClient(`awaybot-${tag}`);
  await bot.join(channel);
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Away messages', () => {
  test('away messages are collected and shown in dialog', async ({ page }) => {
    const nick = `away-tester-${tag}`;
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [channel] });
    await page.getByRole('button', { name: channel, exact: true }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    // Set user as away
    await messageInput.fill('/away Taking a break');
    await messageInput.press('Enter');

    await expect(page.getByTestId('chat-log').getByText('You have been marked as being away')).toBeVisible({ timeout: 10_000 });

    // Bot sends messages mentioning the user's nick
    bot.sendMessage(channel, `Hey ${nick}, are you there?`);
    bot.sendMessage(channel, `Pinging ${nick} again`);

    // Badge should appear on the avatar button
    const avatarButton = page.locator('[data-avatar-button]');
    await expect(avatarButton.locator('..').locator('[aria-label*="unread away"]')).toBeVisible({ timeout: 10_000 });

    // Open the user menu
    await avatarButton.click();

    // "Away Messages" menu item should be visible
    await expect(page.getByRole('menuitem', { name: 'Away Messages' })).toBeVisible();

    // Click it to open the dialog
    await page.getByRole('menuitem', { name: 'Away Messages' }).click();

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Away Messages' })).toBeVisible();
    await expect(dialog.getByText('Messages that mentioned you while you were away')).toBeVisible();

    // Both messages should be listed in the dialog
    await expect(dialog.getByText(`Hey ${nick}, are you there?`)).toBeVisible();
    await expect(dialog.getByText(`Pinging ${nick} again`)).toBeVisible();

    // Each message should show the sender and channel
    await expect(dialog.getByText(bot.nick).first()).toBeVisible();
    await expect(dialog.getByText(channel).first()).toBeVisible();
  });

  test('mark as read clears away messages', async ({ page }) => {
    const nick = `away-clear-${tag}`;
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [channel] });
    await page.getByRole('button', { name: channel, exact: true }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    // Set user as away
    await messageInput.fill('/away Be right back');
    await messageInput.press('Enter');
    await expect(page.getByTestId('chat-log').getByText('You have been marked as being away')).toBeVisible({ timeout: 10_000 });

    // Bot sends a mention
    bot.sendMessage(channel, `Hello ${nick}, check this out!`);

    // Wait for badge
    const avatarButton = page.locator('[data-avatar-button]');
    await expect(avatarButton.locator('..').locator('[aria-label*="unread away"]')).toBeVisible({ timeout: 10_000 });

    // Open away messages dialog
    await avatarButton.click();
    await page.getByRole('menuitem', { name: 'Away Messages' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click "Mark as Read"
    await page.getByRole('button', { name: 'Mark as Read' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Badge should disappear
    await expect(avatarButton.locator('..').locator('[aria-label*="unread away"]')).not.toBeVisible({ timeout: 5_000 });
  });

  test('no away messages collected when not away', async ({ page }) => {
    const nick = `not-away-${tag}`;
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [channel] });
    await page.getByRole('button', { name: channel, exact: true }).click();

    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sends a message mentioning the user (but user is NOT away)
    bot.sendMessage(channel, `Hey ${nick}, just saying hi`);

    await expect(page.getByTestId('chat-log').getByText(`Hey ${nick}, just saying hi`)).toBeVisible({ timeout: 10_000 });

    // Badge should NOT appear on avatar button
    const avatarButton = page.locator('[data-avatar-button]');
    await expect(avatarButton.locator('..').locator('[aria-label*="unread away"]')).toHaveCount(0);

    // Open menu — "Away Messages" should NOT be visible
    await avatarButton.click();
    await expect(page.getByRole('menuitem', { name: 'Away Messages' })).not.toBeVisible();
  });

  test('returning from away stops collecting messages', async ({ page }) => {
    const nick = `away-return-${tag}`;
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [channel] });
    await page.getByRole('button', { name: channel, exact: true }).click();

    const messageInput = page.locator('#message-input');
    await expect(messageInput).toBeEnabled({ timeout: 10_000 });

    // Set user as away
    await messageInput.fill('/away Gone fishing');
    await messageInput.press('Enter');
    await expect(page.getByTestId('chat-log').getByText('You have been marked as being away')).toBeVisible({ timeout: 10_000 });

    // Bot sends a mention while away
    bot.sendMessage(channel, `${nick}, first message while away`);

    // Wait for badge to appear
    const avatarButton = page.locator('[data-avatar-button]');
    await expect(avatarButton.locator('..').locator('[aria-label*="unread away"]')).toBeVisible({ timeout: 10_000 });

    // Return from away by sending /away with no argument
    await messageInput.fill('/away');
    await messageInput.press('Enter');
    await expect(page.getByTestId('chat-log').getByText('You are no longer marked as being away')).toBeVisible({ timeout: 10_000 });

    // Clear existing away messages
    await avatarButton.click();
    await page.getByRole('menuitem', { name: 'Away Messages' }).click();
    await page.getByRole('button', { name: 'Mark as Read' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

    // Bot sends another mention (user is no longer away)
    bot.sendMessage(channel, `${nick}, second message after return`);
    await expect(page.getByTestId('chat-log').getByText(`${nick}, second message after return`)).toBeVisible({ timeout: 10_000 });

    // No new badge should appear
    await expect(avatarButton.locator('..').locator('[aria-label*="unread away"]')).toHaveCount(0);
  });
});
