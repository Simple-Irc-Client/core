import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let page: Page;
let nick: string;
let readChannel: string;
let currentChannel: string;

const unreadBadge = (channel: string) =>
  page.getByTestId('channels-sidebar').getByRole('button', { name: channel, exact: true }).locator('..').locator('[aria-label*="unread"], [aria-label*="mention"]');

const openChannel = async (channel: string): Promise<void> => {
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
};

const sendFromApp = async (text: string): Promise<void> => {
  const messageInput = page.locator('#message-input');
  await messageInput.fill(text);
  await messageInput.press('Enter');
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  skipWithoutIrcv3('history is replayed with draft/chathistory');
  const tag = testTag(testInfo);
  nick = `histuser-${tag}`;
  readChannel = `#hist-read-${tag}`;
  currentChannel = `#hist-current-${tag}`;

  bot = await createIrcClient(`histbot-${tag}`, undefined, undefined, ['echo-message']);
  await bot.join(readChannel);
  await bot.join(currentChannel);

  await installWebSocketKillSwitch(page);
  await page.goto('/');
  await connectViaWizard(page, nick, { channels: [readChannel, currentChannel] });
  await openChannel(currentChannel);
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Chat history replayed after a reconnect', () => {
  test('messages already read do not come back as unread, and old CTCP requests are not answered again', async () => {
    const botLines = bot.captureLines();

    const versionAnswered = bot.waitForLine((line) => line.includes(`NOTICE ${bot.nick} :\x01VERSION `));
    bot.sendMessage(readChannel, `hey ${nick}, are you there?`);
    bot.send(`PRIVMSG ${readChannel} :\x01VERSION\x01`);
    await expect(unreadBadge(readChannel)).toBeVisible({ timeout: 10_000 });
    await versionAnswered;

    await openChannel(readChannel);
    await expect(unreadBadge(readChannel)).not.toBeVisible();
    await openChannel(currentChannel);

    await dropConnection(page);
    const rejoined = bot.waitForLine((line) => line.includes(`JOIN ${readChannel}`) && line.includes(`:${nick}!`), 30_000);
    await page.getByRole('button', { name: 'Connect' }).click();
    await rejoined;
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // The server answers in order: once this echo is back, so is the history asked for on rejoin
    await openChannel(currentChannel);
    await sendFromApp('back after the reconnect');
    const echoed = page.getByTestId('chat-log').locator('.sic-msg', { hasText: 'back after the reconnect' });
    await expect(echoed.locator('.lucide-check-check').first()).toBeVisible({ timeout: 10_000 });

    // Sent after anything the app answered to that history, so the bot has all of it by then
    const caughtUp = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${currentChannel} :and caught up`));
    await sendFromApp('and caught up');
    await caughtUp;
    botLines.stop();

    await expect(unreadBadge(readChannel)).not.toBeVisible();
    expect(botLines.lines.filter((line) => line.includes(`NOTICE ${bot.nick} :\x01VERSION `))).toHaveLength(1);
  });

  test('a reconnect catches up on everything missed, in order, even past one page of history', async () => {
    const missed = Array.from({ length: 80 }, (_, index) => `missed ${String(index + 1).padStart(2, '0')}`);
    const lastMissed = 'missed 80';

    await dropConnection(page);
    const stored = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${currentChannel} :${lastMissed}`));
    for (const text of missed) {
      bot.sendMessage(currentChannel, text);
    }
    await stored;

    const rejoined = bot.waitForLine((line) => line.includes(`JOIN ${currentChannel}`) && line.includes(`:${nick}!`), 30_000);
    await page.getByRole('button', { name: 'Connect' }).click();
    await rejoined;

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('missed 01', { exact: true })).toBeAttached({ timeout: 15_000 });
    await expect(chatLog.getByText(lastMissed, { exact: true })).toBeAttached();

    const texts = await chatLog.locator('.sic-msg').allInnerTexts();
    const shownMissed = texts.flatMap((text) => /missed \d{2}/.exec(text) ?? []);
    expect(shownMissed).toEqual(missed);
    const lastJoin = texts.findLastIndex((text) => text.includes(`${nick} has joined`));
    expect(lastJoin).toBeGreaterThan(texts.findIndex((text) => text.includes(lastMissed)));
  });
});
