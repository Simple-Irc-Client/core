import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('histbot');
  await bot.join('#history-test');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'hist-tester', { channels: ['#history-test'] });
  await sharedPage.getByRole('button', { name: '#history-test', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Input history', () => {
  test.describe.configure({ mode: 'serial' });

  test('arrow up recalls last sent message', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Send a message
    await messageInput.fill('History message one');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('History message one')).toBeVisible({ timeout: 10_000 });

    // Press ArrowUp to recall it
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message one');
  });

  test('arrow up cycles through multiple messages', async () => {
    const messageInput = sharedPage.locator('#message-input');

    // Clear and reset by pressing ArrowDown until empty
    await messageInput.press('ArrowDown');
    await messageInput.fill('');

    // Send two more messages
    await messageInput.fill('History message two');
    await messageInput.press('Enter');
    await messageInput.fill('History message three');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('History message three')).toBeVisible({ timeout: 10_000 });

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
    const messageInput = sharedPage.locator('#message-input');

    // We should be at 'History message one' from the previous test
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
    const messageInput = sharedPage.locator('#message-input');

    // Type something but don't send
    await messageInput.fill('unsent draft');

    // ArrowUp to enter history
    await messageInput.press('ArrowUp');
    await expect(messageInput).toHaveValue('History message three');

    // ArrowDown to return — should restore the unsent draft
    await messageInput.press('ArrowDown');
    await expect(messageInput).toHaveValue('unsent draft');

    // Clear for next tests
    await messageInput.fill('');
  });
});
