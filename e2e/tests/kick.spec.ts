import { test, expect } from '@playwright/test';
import { createIrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

test.describe('Kick', () => {
  test('see kick message when another user is kicked', async ({ page }, testInfo) => {
    const tag = testTag(testInfo);
    // Bot1 creates channel (gets ops), bot2 joins
    const bot1 = await createIrcClient(`kickop-${tag}`);
    await bot1.join(`#kick-test-${tag}`);

    const bot2 = await createIrcClient(`kickvictim-${tag}`);
    await bot2.join(`#kick-test-${tag}`);

    // Browser user joins
    await page.goto('/');
    await connectViaWizard(page, `kick-watcher-${tag}`, { channels: [`#kick-test-${tag}`] });
    await page.getByRole('button', { name: `#kick-test-${tag}`, exact: true }).click();

    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText(`kickvictim-${tag}`)).toBeVisible({ timeout: 10_000 });

    // Bot1 kicks bot2
    bot1.kick(`#kick-test-${tag}`, `kickvictim-${tag}`, 'misbehaving');

    // Kick message should appear in chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(`${bot1.nick} has kicked ${bot2.nick}`)).toBeVisible({ timeout: 10_000 });

    // Kicked user should be removed from sidebar
    await expect(usersSidebar.getByText(`kickvictim-${tag}`)).not.toBeVisible({ timeout: 5_000 });

    bot1.disconnect();
    bot2.disconnect();
  });

  test('user gets kicked from channel', async ({ page }, testInfo) => {
    const tag = testTag(testInfo);
    // Bot creates channel (gets ops)
    const bot = await createIrcClient(`kickerop-${tag}`);
    await bot.join(`#kickme-chan-${tag}`);

    // Browser user joins
    await page.goto('/');
    await connectViaWizard(page, `kickme-user-${tag}`, { channels: [`#kickme-chan-${tag}`] });
    await page.getByRole('button', { name: `#kickme-chan-${tag}`, exact: true }).click();
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Bot kicks the browser user
    bot.kick(`#kickme-chan-${tag}`, `kickme-user-${tag}`, 'you are kicked');

    // Kick notification should be shown
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(/you have been kicked|you are kicked/i).first()).toBeVisible({ timeout: 10_000 });

    bot.disconnect();
  });
});
