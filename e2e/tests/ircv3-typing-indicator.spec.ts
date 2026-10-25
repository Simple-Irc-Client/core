import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  skipWithoutIrcv3('typing notifications are message tags');
  bot = await createIrcClient(`typingbot-${tag}`);
  await bot.join(`#typing-test-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `typing-watcher-${tag}`, { channels: [`#typing-test-${tag}`] });
  await page.getByRole('button', { name: `#typing-test-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

const toggleHideTyping = async (): Promise<void> => {
  await openProfileSettings(page, 'appearance');
  await page.getByTestId('hide-typing-toggle').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
};

test.describe('Typing indicator', () => {
  test('shows typing indicator when another user is typing', async () => {
    // Bot sends TAGMSG with typing=active
    bot.send(`@+typing=active TAGMSG #typing-test-${tag}`);

    // Typing indicator should appear showing the bot's nick
    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText(`typingbot-${tag}`, { timeout: 10_000 });
    await expect(typingStatus).toContainText('typing', { timeout: 5_000 });
  });

  test('typing indicator disappears when user stops typing', async () => {
    // Bot starts typing
    bot.send(`@+typing=active TAGMSG #typing-test-${tag}`);

    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText(`typingbot-${tag}`, { timeout: 10_000 });

    // Bot sends done typing
    bot.send(`@+typing=done TAGMSG #typing-test-${tag}`);

    // Typing indicator should disappear
    await expect(typingStatus).not.toContainText(`typingbot-${tag}`, { timeout: 10_000 });
  });

  test('profile settings toggle hides typing indicator', async () => {
    // Verify typing indicator is initially visible when bot types
    bot.send(`@+typing=active TAGMSG #typing-test-${tag}`);

    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText(`typingbot-${tag}`, { timeout: 10_000 });

    // Stop typing first
    bot.send(`@+typing=done TAGMSG #typing-test-${tag}`);
    await expect(typingStatus).not.toContainText(`typingbot-${tag}`, { timeout: 10_000 });

    await toggleHideTyping();

    // Bot starts typing again, then says something: once that shows, the typing has been handled
    bot.send(`@+typing=active TAGMSG #typing-test-${tag}`);
    bot.sendMessage(`#typing-test-${tag}`, 'typed while hidden');
    await expect(page.getByTestId('chat-log').getByText('typed while hidden')).toBeVisible({ timeout: 10_000 });

    // Typing indicator should NOT appear (entire component is hidden)
    await expect(page.locator('.text-gray-500').filter({ hasText: `typingbot-${tag}` })).not.toBeVisible();
  });

  test('re-enabling typing indicator shows it again', async () => {
    await toggleHideTyping();
    await toggleHideTyping();

    // Bot starts typing
    bot.send(`@+typing=active TAGMSG #typing-test-${tag}`);

    // Typing indicator should appear again
    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText(`typingbot-${tag}`, { timeout: 10_000 });
  });

  test('own typing does not show a self typing indicator', async () => {
    // Type letter by letter so the client sends typing TAGMSGs,
    // which the server echoes back (echo-message)
    const messageInput = page.locator('#message-input');
    await messageInput.pressSequentially('typing something slowly', { delay: 80 });

    // Our own nick must never appear as typing
    await expect(page.getByText(`typing-watcher-${tag} is typing...`)).not.toBeVisible();
  });

  test('typing indicator expires when the sender goes silent', async () => {
    // Bot starts typing and then never sends 'done' (e.g. its client died)
    bot.send(`@+typing=active TAGMSG #typing-test-${tag}`);

    const typingStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(typingStatus).toContainText(`typingbot-${tag}`, { timeout: 10_000 });

    // The indicator goes stale after 6s without updates
    await expect(typingStatus).not.toContainText(`typingbot-${tag}`, { timeout: 10_000 });
  });
});
