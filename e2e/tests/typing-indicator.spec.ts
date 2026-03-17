import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('typingbot');
  await bot.join('#typing-test');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Typing indicator', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows typing indicator when another user is typing', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'typing-watcher', { channels: ['#typing-test'] });
    await page.getByRole('button', { name: '#typing-test' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot sends TAGMSG with typing=active
    bot.send('@+typing=active TAGMSG #typing-test');

    // Typing indicator should appear showing the bot's nick
    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });
    await expect(typingStatus).toContainText('typing', { timeout: 5_000 });
  });

  test('typing indicator disappears when user stops typing', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'typing-stop', { channels: ['#typing-test'] });
    await page.getByRole('button', { name: '#typing-test' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot starts typing
    bot.send('@+typing=active TAGMSG #typing-test');

    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });

    // Bot sends done typing
    bot.send('@+typing=done TAGMSG #typing-test');

    // Typing indicator should disappear
    await expect(typingStatus).not.toContainText('typingbot', { timeout: 10_000 });
  });

  test('profile settings toggle hides typing indicator', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'typing-hide', { channels: ['#typing-test'] });
    await page.getByRole('button', { name: '#typing-test' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Verify typing indicator is initially visible when bot types
    bot.send('@+typing=active TAGMSG #typing-test');

    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });

    // Stop typing first
    bot.send('@+typing=done TAGMSG #typing-test');
    await expect(typingStatus).not.toContainText('typingbot', { timeout: 10_000 });

    // Open profile settings and toggle off typing indicator
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const hideTypingToggle = page.getByTestId('hide-typing-toggle');
    await expect(hideTypingToggle).toBeVisible();
    await hideTypingToggle.click();

    // Close the dialog
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Bot starts typing again
    bot.send('@+typing=active TAGMSG #typing-test');

    // Typing indicator should NOT appear (entire component is hidden)
    // Wait a bit to ensure it doesn't appear
    await new Promise((r) => setTimeout(r, 2000));
    await expect(page.locator('.text-gray-500').filter({ hasText: 'typingbot' })).not.toBeVisible();
  });

  test('re-enabling typing indicator shows it again', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'typing-reenable', { channels: ['#typing-test'] });
    await page.getByRole('button', { name: '#typing-test' }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Disable typing indicator
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await page.getByTestId('hide-typing-toggle').click();
    await page.keyboard.press('Escape');

    // Re-enable typing indicator
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await page.getByTestId('hide-typing-toggle').click();
    await page.keyboard.press('Escape');

    // Bot starts typing
    bot.send('@+typing=active TAGMSG #typing-test');

    // Typing indicator should appear again
    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText('typingbot', { timeout: 10_000 });
  });
});
