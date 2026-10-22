import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let sharedPage: Page;
let nick: string;
let readChannel: string;
let currentChannel: string;

const unreadBadge = (channel: string) =>
  sharedPage.getByTestId('channels-sidebar').getByRole('button', { name: channel, exact: true }).locator('..').locator('[aria-label*="unread"], [aria-label*="mention"]');

const openChannel = async (channel: string): Promise<void> => {
  await sharedPage.getByRole('button', { name: channel, exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
};

const sendFromApp = async (text: string): Promise<void> => {
  const messageInput = sharedPage.locator('#message-input');
  await messageInput.fill(text);
  await messageInput.press('Enter');
};

test.beforeAll(async ({ browser }, testInfo) => {
  skipWithoutIrcv3('history is replayed with draft/chathistory');
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  nick = `histuser-${tag}`;
  readChannel = `#hist-read-${tag}`;
  currentChannel = `#hist-current-${tag}`;

  bot = await createIrcClient(`histbot-${tag}`);
  await bot.join(readChannel);
  await bot.join(currentChannel);

  sharedPage = await browser.newPage();
  await installWebSocketKillSwitch(sharedPage);
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, nick, { channels: [readChannel, currentChannel] });
  await openChannel(currentChannel);
});

test.afterAll(async () => {
  await sharedPage?.close();
  bot?.disconnect();
});

test.describe('Chat history replayed after a reconnect', () => {
  test.describe.configure({ mode: 'serial' });

  test('messages already read do not come back as unread, and old CTCP requests are not answered again', async () => {
    const botLines = bot.captureLines();

    bot.sendMessage(readChannel, `hey ${nick}, are you there?`);
    bot.send(`PRIVMSG ${readChannel} :\x01VERSION\x01`);
    await expect(unreadBadge(readChannel)).toBeVisible({ timeout: 10_000 });
    await bot.waitForLine((line) => line.includes(`NOTICE ${bot.nick} :\x01VERSION `));

    await openChannel(readChannel);
    await expect(unreadBadge(readChannel)).not.toBeVisible();
    await openChannel(currentChannel);

    await dropConnection(sharedPage);
    const rejoined = bot.waitForLine((line) => line.includes(`JOIN ${readChannel}`) && line.includes(`:${nick}!`), 30_000);
    await sharedPage.getByRole('button', { name: 'Connect' }).click();
    await rejoined;
    await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // The server answers in order: once this echo is back, so is the history asked for on rejoin
    await openChannel(currentChannel);
    await sendFromApp('back after the reconnect');
    const echoed = sharedPage.getByTestId('chat-log').locator('.sic-msg', { hasText: 'back after the reconnect' });
    await expect(echoed.locator('.lucide-check-check').first()).toBeVisible({ timeout: 10_000 });

    // Sent after anything the app answered to that history, so the bot has all of it by then
    const caughtUp = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${currentChannel} :and caught up`));
    await sendFromApp('and caught up');
    await caughtUp;
    botLines.stop();

    await expect(unreadBadge(readChannel)).not.toBeVisible();
    expect(botLines.lines.filter((line) => line.includes(`NOTICE ${bot.nick} :\x01VERSION `))).toHaveLength(1);
  });
});
