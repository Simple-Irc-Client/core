import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`fmtbot-${tag}`);
  await bot.join(`#formatting-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `fmt-tester-${tag}`, { channels: [`#formatting-${tag}`] });
  await page.getByRole('button', { name: `#formatting-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Formatting tools', () => {
  test('emoji picker opens and inserts emoji into message input', async () => {
    // Click emoji button
    await page.getByRole('button', { name: /emoticons/i }).click();

    // Emoji picker should open
    await expect(page.locator('.epr-main')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('gridcell', { name: 'grinning face', exact: true }).click();

    await expect(page.locator('#message-input')).toHaveValue('😀');

    // Picker should close after selection
    await expect(page.locator('.epr-main')).not.toBeVisible({ timeout: 3_000 });
  });

  test('color picker opens, selects color, and clears color', async () => {
    const colorButton = page.getByRole('button', { name: /text color/i });

    // Click color button to open picker
    await colorButton.click();

    // Picker should show color options
    await expect(page.getByText('Text Color')).toBeVisible({ timeout: 3_000 });

    // Select the first color swatch
    await page.getByRole('button', { name: /color 0/i }).click();

    // Color indicator should appear on the button
    await expect(colorButton.locator('span.absolute')).toBeVisible({ timeout: 3_000 });

    // Reopen picker and clear color
    await colorButton.click();
    await page.getByRole('button', { name: /clear color/i }).click();

    // Color indicator should be gone
    await expect(colorButton.locator('span.absolute')).not.toBeVisible({ timeout: 3_000 });
  });

  test('style picker toggles bold/italic/underline', async () => {
    const styleButton = page.getByRole('button', { name: /text style/i });

    // Click style button to open picker
    await styleButton.click();

    // Picker should show style buttons
    await expect(page.getByText('Text Style')).toBeVisible({ timeout: 3_000 });

    // Toggle Bold
    const boldButton = page.getByRole('button', { name: /bold/i });
    await expect(boldButton).toHaveAttribute('aria-pressed', 'false');
    await boldButton.click();
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true');

    // Toggle Italic
    const italicButton = page.getByRole('button', { name: /italic/i });
    await expect(italicButton).toHaveAttribute('aria-pressed', 'false');
    await italicButton.click();
    await expect(italicButton).toHaveAttribute('aria-pressed', 'true');

    // Toggle Underline
    const underlineButton = page.getByRole('button', { name: /underline/i });
    await expect(underlineButton).toHaveAttribute('aria-pressed', 'false');
    await underlineButton.click();
    await expect(underlineButton).toHaveAttribute('aria-pressed', 'true');

    // Active indicator dot should appear on the style button
    await expect(styleButton.locator('span.absolute')).toBeVisible();

    // Toggle bold off
    await boldButton.click();
    await expect(boldButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('send formatted message with bold and color', async () => {
    // Enable bold
    await page.getByRole('button', { name: /text style/i }).click();
    await page.getByRole('button', { name: /bold/i }).click();
    await expect(page.getByRole('button', { name: /bold/i })).toHaveAttribute('aria-pressed', 'true');

    // Close style picker by clicking elsewhere
    await page.locator('#message-input').click();

    // Enable color
    await page.getByRole('button', { name: /text color/i }).click();
    await page.getByRole('button', { name: /color 4/i }).click();

    // Type and send message
    const messageInput = page.locator('#message-input');
    await messageInput.fill('Formatted message');
    await messageInput.press('Enter');

    // The message should appear in chat log (with formatting applied by the renderer)
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Formatted message')).toBeVisible({ timeout: 10_000 });
  });
});
