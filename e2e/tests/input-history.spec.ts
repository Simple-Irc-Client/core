import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`histbot-${tag}`);
  await bot.join(`#history-test-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `hist-tester-${tag}`, { channels: [`#history-test-${tag}`] });
  await page.getByRole('button', { name: `#history-test-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot.disconnect();
});

/** Sends each text in turn, waiting until the last one is in the log */
const sendAll = async (...texts: string[]): Promise<void> => {
  const messageInput = page.locator('#message-input');
  for (const text of texts) {
    await messageInput.fill(text);
    await messageInput.press('Enter');
  }
  await expect(page.getByTestId('chat-log').getByText(texts.at(-1) ?? '')).toBeVisible({ timeout: 10_000 });
};

test.describe('Input history', () => {
  test('arrow up recalls last sent message', async () => {
    const messageInput = page.locator('#message-input');
    await sendAll('History message one');

    // Press ArrowUp to recall it
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message one');
  });

  test('arrow up cycles through multiple messages', async () => {
    const messageInput = page.locator('#message-input');
    await sendAll('History message one', 'History message two', 'History message three');

    // ArrowUp once → most recent (three)
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message three');

    // ArrowUp again → second most recent (two)
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message two');

    // ArrowUp again → oldest (one)
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message one');
  });

  test('arrow down navigates forward through history', async () => {
    const messageInput = page.locator('#message-input');
    await sendAll('History message one', 'History message two', 'History message three');
    for (const expected of ['History message three', 'History message two', 'History message one']) {
      await messageInput.press('ArrowUp');
      await expect(messageInput).toHaveValue(expected);
    }

    // ArrowDown → back to two
    await messageInput.press('ArrowDown');
    await expect(messageInput).toHaveValue('History message two');

    // ArrowDown → back to three
    await messageInput.press('ArrowDown');
    await expect(messageInput).toHaveValue('History message three');

    // ArrowDown → restores original input (empty since we had nothing typed)
    await messageInput.press('ArrowDown');
    await expect(messageInput).toHaveValue('');
  });

  test('arrow up preserves current input and restores it on arrow down', async () => {
    const messageInput = page.locator('#message-input');
    await sendAll('History message three');

    // Type something but don't send
    await messageInput.fill('unsent draft');

    // ArrowUp to enter history
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message three');

    // ArrowDown to return — should restore the unsent draft
    await messageInput.press('ArrowDown');
    await expect(messageInput).toHaveValue('unsent draft');
  });
});
