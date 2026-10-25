import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, projectTag } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;
let channel: string;

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = projectTag(testInfo);
  channel = `#autocomplete-${tag}`;

  bot = await createIrcClient(`compbot-${tag}`);
  await bot.join(channel);

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, `compuser-${tag}`, { channels: [channel] });
  await sharedPage.getByRole('button', { name: channel, exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

  // Wait for users sidebar to populate
  const usersSidebar = sharedPage.getByTestId('users-sidebar');
  await expect(usersSidebar.getByText(bot.nick)).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Autocomplete', () => {
  test.describe.configure({ mode: 'serial' });

  test('Tab completes slash commands', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type partial command and press Tab
    await messageInput.pressSequentially('/jo');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue('/join ');

    // Clear input
    await messageInput.fill('');
  });

  test('Tab cycles through matching commands', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type /me — should match /me first
    await messageInput.pressSequentially('/me');
    await messageInput.press('Tab');
    const firstMatch = await messageInput.inputValue();
    expect(firstMatch.startsWith('/me')).toBe(true);

    // Clear input
    await messageInput.fill('');
  });

  test('Tab completes channel names', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type partial channel name
    await messageInput.pressSequentially('#auto');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue(`${channel} `);

    // Clear input
    await messageInput.fill('');
  });

  test('Tab completes user nicknames', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type partial username matching the bot
    await messageInput.pressSequentially('compb');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue(`${bot.nick} `);

    // Clear input
    await messageInput.fill('');
  });

  test('Tab completes user nicknames in mid-sentence', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type a sentence then partial username
    await messageInput.pressSequentially('hello compb');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue(`hello ${bot.nick} `);

    // Clear input
    await messageInput.fill('');
  });

  test('Tab completes commands in mid-sentence', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type text then a command (should autocomplete the last word)
    await messageInput.pressSequentially('try /jo');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue('try /join ');

    // Clear input
    await messageInput.fill('');
  });

  test('no autocomplete for empty input', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Ensure input is empty, press Tab
    await messageInput.fill('');
    await messageInput.press('Tab');

    // Input should remain empty
    await expect(messageInput).toHaveValue('');
  });
});
