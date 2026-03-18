import { test, expect } from '@playwright/test';
import { createIrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

test.describe('Kick', () => {
  test.describe.configure({ mode: 'serial' });

  test('see kick message when another user is kicked', async ({ page }) => {
    // Bot1 creates channel (gets ops), bot2 joins
    const bot1 = await createIrcClient('kickop');
    await bot1.join('#kick-test');

    const bot2 = await createIrcClient('kickvictim');
    await bot2.join('#kick-test');

    // Browser user joins
    await page.goto('/');
    await connectViaWizard(page, 'kick-watcher', { channels: ['#kick-test'] });
    await page.getByRole('button', { name: '#kick-test', exact: true }).click();

    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('kickvictim')).toBeVisible({ timeout: 10_000 });

    // Bot1 kicks bot2
    bot1.kick('#kick-test', 'kickvictim', 'misbehaving');

    // Kick message should appear in chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(/kickop has kicked kickvictim/)).toBeVisible({ timeout: 10_000 });

    // Kicked user should be removed from sidebar
    await expect(usersSidebar.getByText('kickvictim')).not.toBeVisible({ timeout: 5_000 });

    bot1.disconnect();
    bot2.disconnect();
  });

  test('user gets kicked from channel', async ({ page }) => {
    // Bot creates channel (gets ops)
    const bot = await createIrcClient('kickerop');
    await bot.join('#kickme-chan');

    // Browser user joins
    await page.goto('/');
    await connectViaWizard(page, 'kickme-user', { channels: ['#kickme-chan'] });
    await page.getByRole('button', { name: '#kickme-chan', exact: true }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot kicks the browser user
    bot.kick('#kickme-chan', 'kickme-user', 'you are kicked');

    // Kick notification should be shown
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(/you have been kicked|you are kicked/i).first()).toBeVisible({ timeout: 10_000 });

    bot.disconnect();
  });
});
