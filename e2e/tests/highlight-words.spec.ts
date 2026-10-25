import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let channel: string;
let otherChannel: string;
let nick: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

const addHighlightWord = async (word: string): Promise<void> => {
  await openProfileSettings(page, 'notifications');
  const field = page.getByLabel('Highlight words');
  await field.fill(word);
  await field.press('Enter');
  await expect(page.getByTestId('highlight-words-list')).toHaveText(word);
  await page.keyboard.press('Escape');
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  channel = `#hlwords-${tag}`;
  otherChannel = `#hlwords-other-${tag}`;
  nick = `hluser-${tag}`;

  bot = await createIrcClient(`hlbot-${tag}`);
  await bot.join(channel);
  await bot.join(otherChannel);

  await page.goto('/');
  await connectViaWizard(page, nick, { channels: [channel, otherChannel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Highlight words', () => {
  test('a word added in the settings highlights a message containing it', async () => {
    await addHighlightWord('deploy');

    bot.sendMessage(channel, 'starting the Deploy now');
    await expect(messageRow('starting the Deploy now')).toHaveAttribute('data-highlight', 'true', { timeout: 10_000 });
  });

  test('the word or the nick inside another word does not highlight', async () => {
    await addHighlightWord('deploy');
    bot.sendMessage(channel, `redeployed for ${nick}x`);
    bot.sendMessage(channel, 'plain marker line');

    await expect(messageRow('plain marker line')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow(`redeployed for ${nick}x`)).not.toHaveAttribute('data-highlight');
  });

  test('the word marks another channel as mentioned', async () => {
    await addHighlightWord('deploy');
    bot.sendMessage(otherChannel, 'deploy is done');

    await expect(page.getByLabel('1 mention')).toBeVisible({ timeout: 10_000 });
  });

  test('a removed word no longer highlights', async () => {
    await addHighlightWord('deploy');
    await openProfileSettings(page, 'notifications');
    await page.getByRole('button', { name: 'Remove deploy' }).click();
    await expect(page.getByTestId('highlight-words-list')).toHaveCount(0);
    await page.keyboard.press('Escape');

    bot.sendMessage(channel, 'one more deploy');
    await expect(messageRow('one more deploy')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow('one more deploy')).not.toHaveAttribute('data-highlight');
  });
});
