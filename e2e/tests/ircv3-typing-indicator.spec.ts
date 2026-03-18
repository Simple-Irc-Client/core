import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('typingbot');
  await bot.join('#typing-test');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'typing-watcher', { channels: ['#typing-test'] });
  await sharedPage.getByRole('button', { name: '#typing-test', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Typing indicator', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows typing indicator when another user is typing', async () => {
    // Bot sends TAGMSG with typing=active
    bot.send('@+typing=active TAGMSG #typing-test');

    // Typing indicator should appear showing the bot's nick
    const typingStatus = sharedPage.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });
    await expect(typingStatus).toContainText('typing', { timeout: 5_000 });
  });

  test('typing indicator disappears when user stops typing', async () => {
    // Bot starts typing
    bot.send('@+typing=active TAGMSG #typing-test');

    const typingStatus = sharedPage.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });

    // Bot sends done typing
    bot.send('@+typing=done TAGMSG #typing-test');

    // Typing indicator should disappear
    await expect(typingStatus).not.toContainText('typingbot', { timeout: 10_000 });
  });

  test('profile settings toggle hides typing indicator', async () => {
    // Verify typing indicator is initially visible when bot types
    bot.send('@+typing=active TAGMSG #typing-test');

    const typingStatus = sharedPage.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });

    // Stop typing first
    bot.send('@+typing=done TAGMSG #typing-test');
    await expect(typingStatus).not.toContainText('typingbot', { timeout: 10_000 });

    // Open profile settings and toggle off typing indicator
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible();

    const hideTypingToggle = sharedPage.getByTestId('hide-typing-toggle');
    await expect(hideTypingToggle).toBeVisible();
    await hideTypingToggle.click();

    // Close the dialog
    await sharedPage.keyboard.press('Escape');
    await expect(sharedPage.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Bot starts typing again
    bot.send('@+typing=active TAGMSG #typing-test');

    // Typing indicator should NOT appear (entire component is hidden)
    // Wait a bit to ensure it doesn't appear
    await new Promise((r) => setTimeout(r, 2000));
    await expect(sharedPage.locator('.text-gray-500').filter({ hasText: 'typingbot' })).not.toBeVisible();
  });

  test('re-enabling typing indicator shows it again', async () => {
    // Re-enable typing indicator (was disabled in previous test)
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await sharedPage.getByTestId('hide-typing-toggle').click();
    await sharedPage.keyboard.press('Escape');

    // Bot starts typing
    bot.send('@+typing=active TAGMSG #typing-test');

    // Typing indicator should appear again
    const typingStatus = sharedPage.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });
  });
});
