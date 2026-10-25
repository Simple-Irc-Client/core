import { randomBytes } from 'node:crypto';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient, registerMulticlientAccount } from '../irc-client';
import { connectViaWizard, identifyInApp, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

const PASSWORD = 'delete-it-42';

let bot: IrcClient;
let page: Page;
let channel: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

const say = async (text: string): Promise<Locator> => {
  const input = page.locator('#message-input');
  await input.fill(text);
  await input.press('Enter');
  const row = messageRow(text);
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  return row;
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  skipWithoutIrcv3('ngircd has no draft/message-redaction');
  const tag = testTag(testInfo);
  // Accounts outlive a retried test; a fresh name per attempt
  const account = `redact-${tag}-${randomBytes(3).toString('hex')}`;
  channel = `#redact-${tag}-${randomBytes(3).toString('hex')}`;

  await registerMulticlientAccount({ account, password: PASSWORD });
  // First in, the bot is the channel's operator
  bot = await createIrcClient(`redactbot-${tag}`, undefined, undefined, ['message-tags', 'draft/message-redaction']);
  await bot.join(channel);

  await page.goto('/');
  await connectViaWizard(page, account, { channels: [channel] });
  await identifyInApp(page, account, PASSWORD);
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Deleting messages', () => {
  test('the user deletes their own message once they confirm, for everyone', async () => {
    const row = await say('oops, wrong channel');
    const relayed = bot.waitForLine((line) => line.includes(` REDACT ${channel} `));

    await row.hover();
    await row.locator('.sic-msg-delete-action').click();
    const dialog = page.getByTestId('redact-dialog');
    await expect(dialog).toContainText('oops, wrong channel');
    await page.getByTestId('redact-confirm').click();

    await expect(dialog).toBeHidden();
    await relayed;
    const deleted = page.getByTestId('chat-log').locator('.sic-msg[data-redacted]');
    await expect(deleted).toHaveCount(1, { timeout: 10_000 });
    await expect(deleted.locator('.sic-msg-redacted')).toBeVisible();
    await expect(messageRow('oops, wrong channel')).toHaveCount(0);
  });

  test('cancelling keeps the message', async () => {
    const row = await say('second thoughts');

    await row.hover();
    await row.locator('.sic-msg-delete-action').click();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('redact-dialog')).toBeHidden();
    await expect(row).not.toHaveAttribute('data-redacted');
  });

  test('a channel operator deleting the user\'s message removes it here too', async () => {
    const seen = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :against the rules`));
    await say('against the rules');
    const msgid = /^@(?:\S*;)?msgid=([^; ]+)/.exec(await seen)?.[1];
    expect(msgid).toBeDefined();

    bot.send(`REDACT ${channel} ${msgid ?? ''} :spam`);

    await expect(page.getByTestId('chat-log').locator('.sic-msg[data-redacted]')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow('against the rules')).toHaveCount(0);
  });

  test('someone else\'s message cannot be deleted by a user who is not an operator', async () => {
    bot.sendMessage(channel, 'the operator speaks');
    const row = messageRow('the operator speaks');
    await expect(row).toHaveCount(1, { timeout: 10_000 });

    await row.hover();

    await expect(row.locator('.sic-msg-reply-action')).toBeVisible();
    await expect(row.locator('.sic-msg-delete-action')).toHaveCount(0);
  });
});
