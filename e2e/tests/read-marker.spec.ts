import { randomBytes } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, IrcClient, registerMulticlientAccount } from '../irc-client';
import { connectViaWizard, getServerPassword, identifyInApp, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

// ergo's multiclient stands in for a bouncer: the app and a "phone" are two sessions of one account
const PASSWORD = 'read-on-phone-42';

let bot: IrcClient;
let phone: IrcClient;
let page: Page;
let readChannel: string;
let idleChannel: string;

const unreadBadge = () =>
  page.getByTestId('channels-sidebar').getByRole('button', { name: readChannel, exact: true }).locator('..').locator('[aria-label*="unread"], [aria-label*="mention"]');

const serverTimeOf = (line: string): string => {
  const time = /^@(?:\S*;)?time=([^; ]+)/.exec(line)?.[1];
  if (time === undefined) {
    throw new Error(`no server time on: ${line}`);
  }
  return time;
};

/** Sent by the bot; resolves to the server time the phone saw it with */
const botSays = async (text: string): Promise<string> => {
  const seen = phone.waitForLine((line) => line.endsWith(`PRIVMSG ${readChannel} :${text}`));
  bot.sendMessage(readChannel, text);
  return serverTimeOf(await seen);
};

const openChannel = async (channel: string): Promise<void> => {
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  skipWithoutIrcv3('ergo multiclient stands in for a bouncer');
  const tag = testTag(testInfo);
  // Accounts outlive a retried test; a fresh name per attempt
  const account = `readmark-${tag}-${randomBytes(3).toString('hex')}`;
  readChannel = `#readmark-${tag}`;
  idleChannel = `#readmark-idle-${tag}`;

  await registerMulticlientAccount({ account, password: PASSWORD });
  bot = await createIrcClient(`readbot-${tag}`);
  await bot.join(readChannel);
  await bot.join(idleChannel);

  await page.goto('/');
  await connectViaWizard(page, account, { channels: [readChannel, idleChannel] });
  await identifyInApp(page, account, PASSWORD);
  await openChannel(idleChannel);

  phone = new IrcClient(account, getServerPassword(), ['server-time', 'draft/read-marker'], { account, password: PASSWORD });
  await phone.connect();
});

test.afterEach(() => {
  phone?.disconnect();
  bot?.disconnect();
});

test.describe('Read state shared with other clients of the same account (draft/read-marker)', () => {
  test('messages read on the phone stop counting as unread in the app, up to where they were read', async () => {
    const first = await botSays('first');
    const second = await botSays('second');
    await expect(unreadBadge()).toHaveAttribute('aria-label', '2 unread messages', { timeout: 10_000 });

    phone.send(`MARKREAD ${readChannel} timestamp=${first}`);
    await expect(unreadBadge()).toHaveAttribute('aria-label', '1 unread message', { timeout: 10_000 });

    phone.send(`MARKREAD ${readChannel} timestamp=${second}`);
    await expect(unreadBadge()).not.toBeVisible({ timeout: 10_000 });
  });

  test('reading a channel in the app marks it read on the phone, including messages arriving while it is open', async () => {
    const third = await botSays('third');
    await expect(unreadBadge()).toBeVisible({ timeout: 10_000 });

    const openedMarker = phone.waitForLine((line) => line.endsWith(`MARKREAD ${readChannel} timestamp=${third}`));
    await openChannel(readChannel);
    await openedMarker;

    const liveMarker = phone.waitForLine((line) => line.includes(`MARKREAD ${readChannel} timestamp=`) && !line.endsWith(third));
    const fourth = await botSays('fourth');
    expect(await liveMarker).toContain(`MARKREAD ${readChannel} timestamp=${fourth}`);
  });
});
