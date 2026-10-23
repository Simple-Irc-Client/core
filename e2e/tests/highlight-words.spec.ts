import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let page: Page;
let channel: string;
let otherChannel: string;
let nick: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#hlwords-${tag}`;
  otherChannel = `#hlwords-other-${tag}`;
  nick = `hluser-${tag}`;

  bot = await createIrcClient(`hlbot-${tag}`);
  await bot.join(channel);
  await bot.join(otherChannel);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, nick, { channels: [channel, otherChannel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  bot?.disconnect();
});

test.describe('Highlight words', () => {
  test.describe.configure({ mode: 'serial' });

  test('a word added in the settings highlights a message containing it', async () => {
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();
    const field = page.getByLabel('Highlight words');
    await field.fill('deploy');
    await field.press('Enter');
    await expect(page.getByTestId('highlight-words')).toHaveText('deploy');
    await page.keyboard.press('Escape');

    bot.sendMessage(channel, 'starting the Deploy now');
    await expect(messageRow('starting the Deploy now')).toHaveAttribute('data-highlight', 'true', { timeout: 10_000 });
  });

  test('the word or the nick inside another word does not highlight', async () => {
    bot.sendMessage(channel, `redeployed for ${nick}x`);
    bot.sendMessage(channel, 'plain marker line');

    await expect(messageRow('plain marker line')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow(`redeployed for ${nick}x`)).not.toHaveAttribute('data-highlight');
  });

  test('the word marks another channel as mentioned', async () => {
    bot.sendMessage(otherChannel, 'deploy is done');

    await expect(page.getByLabel('1 mention')).toBeVisible({ timeout: 10_000 });
  });

  test('a removed word no longer highlights', async () => {
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await page.getByRole('button', { name: 'Remove deploy' }).click();
    await expect(page.getByTestId('highlight-words')).toHaveCount(0);
    await page.keyboard.press('Escape');

    bot.sendMessage(channel, 'one more deploy');
    await expect(messageRow('one more deploy')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow('one more deploy')).not.toHaveAttribute('data-highlight');
  });
});
