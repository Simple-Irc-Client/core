import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('fmtbot');
  await bot.join('#formatting');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'fmt-tester', { channels: ['#formatting'] });
  await sharedPage.getByRole('button', { name: '#formatting', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage?.close();
  bot?.disconnect();
});

test.describe('Formatting tools', () => {
  test.describe.configure({ mode: 'serial' });

  test('emoji picker opens and inserts emoji into message input', async () => {
    // Click emoji button
    await sharedPage.getByRole('button', { name: /emoticons/i }).click();

    // Emoji picker should open
    await expect(sharedPage.locator('.epr-main')).toBeVisible({ timeout: 5_000 });

    // Click the first emoji in the picker
    const firstEmoji = sharedPage.locator('.epr-body button[data-unified]').first();
    await firstEmoji.click();

    // The message input should now contain the emoji
    const messageInput = sharedPage.locator('#message-input');
    const value = await messageInput.inputValue();
    expect(value.length).toBeGreaterThan(0);

    // Picker should close after selection
    await expect(sharedPage.locator('.epr-main')).not.toBeVisible({ timeout: 3_000 });
  });

  test('color picker opens, selects color, and clears color', async () => {
    const colorButton = sharedPage.getByRole('button', { name: /text color/i });

    // Click color button to open picker
    await colorButton.click();

    // Picker should show color options
    await expect(sharedPage.getByText('Text Color')).toBeVisible({ timeout: 3_000 });

    // Select the first color swatch
    await sharedPage.getByRole('button', { name: /color 0/i }).click();

    // Color indicator should appear on the button
    await expect(colorButton.locator('span.absolute')).toBeVisible({ timeout: 3_000 });

    // Reopen picker and clear color
    await colorButton.click();
    await sharedPage.getByRole('button', { name: /clear color/i }).click();

    // Color indicator should be gone
    await expect(colorButton.locator('span.absolute')).not.toBeVisible({ timeout: 3_000 });
  });

  test('style picker toggles bold/italic/underline', async () => {
    const styleButton = sharedPage.getByRole('button', { name: /text style/i });

    // Click style button to open picker
    await styleButton.click();

    // Picker should show style buttons
    await expect(sharedPage.getByText('Text Style')).toBeVisible({ timeout: 3_000 });

    // Toggle Bold
    const boldButton = sharedPage.getByRole('button', { name: /bold/i });
    await expect(boldButton).toHaveAttribute('aria-pressed', 'false');
    await boldButton.click();
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true');

    // Toggle Italic
    const italicButton = sharedPage.getByRole('button', { name: /italic/i });
    await expect(italicButton).toHaveAttribute('aria-pressed', 'false');
    await italicButton.click();
    await expect(italicButton).toHaveAttribute('aria-pressed', 'true');

    // Toggle Underline
    const underlineButton = sharedPage.getByRole('button', { name: /underline/i });
    await expect(underlineButton).toHaveAttribute('aria-pressed', 'false');
    await underlineButton.click();
    await expect(underlineButton).toHaveAttribute('aria-pressed', 'true');

    // Active indicator dot should appear on the style button
    await expect(styleButton.locator('span.absolute')).toBeVisible();

    // Toggle bold off
    await boldButton.click();
    await expect(boldButton).toHaveAttribute('aria-pressed', 'false');

    // Close style picker by clicking the message input
    await sharedPage.locator('#message-input').click();
  });

  test('send formatted message with bold and color', async () => {
    // Enable bold
    await sharedPage.getByRole('button', { name: /text style/i }).click();
    await sharedPage.getByRole('button', { name: /bold/i }).click();
    await expect(sharedPage.getByRole('button', { name: /bold/i })).toHaveAttribute('aria-pressed', 'true');

    // Close style picker by clicking elsewhere
    await sharedPage.locator('#message-input').click();

    // Enable color
    await sharedPage.getByRole('button', { name: /text color/i }).click();
    await sharedPage.getByRole('button', { name: /color 4/i }).click();

    // Type and send message
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('Formatted message');
    await messageInput.press('Enter');

    // The message should appear in chat log (with formatting applied by the renderer)
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Formatted message')).toBeVisible({ timeout: 10_000 });
  });
});
