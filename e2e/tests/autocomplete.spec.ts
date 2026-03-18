import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('compbot');
  await bot.join('#autocomplete');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'comp-tester', { channels: ['#autocomplete'] });
  await sharedPage.getByRole('button', { name: '#autocomplete', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

  // Wait for users sidebar to populate
  const usersSidebar = sharedPage.getByTestId('users-sidebar');
  await expect(usersSidebar.getByText('compbot')).toBeVisible({ timeout: 10_000 });
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

    await expect(messageInput).toHaveValue('#autocomplete ');

    // Clear input
    await messageInput.fill('');
  });

  test('Tab completes user nicknames', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type partial username matching 'compbot'
    await messageInput.pressSequentially('comp');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue('compbot ');

    // Clear input
    await messageInput.fill('');
  });

  test('Tab completes user nicknames in mid-sentence', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Type a sentence then partial username
    await messageInput.pressSequentially('hello comp');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue('hello compbot ');

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
