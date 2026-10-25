import { randomBytes } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, IrcClient, registerMulticlientAccount } from '../irc-client';
import { connectViaWizard, getServerPassword, identifyInApp, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

// ergo's multiclient stands in for a bouncer: the app and a "phone" are two sessions of one account
const PASSWORD = 'phone-and-app-42';

let account: string;
let peer: IrcClient;
let phone: IrcClient;
let page: Page;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  skipWithoutIrcv3('ergo multiclient stands in for a bouncer');
  const tag = testTag(testInfo);
  // Accounts outlive a retried test; a fresh name per attempt
  account = `selfmsg-${tag}-${randomBytes(3).toString('hex')}`;

  await registerMulticlientAccount({ account, password: PASSWORD });
  peer = await createIrcClient(`selfpeer-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, account);

  await identifyInApp(page, account, PASSWORD);

  phone = new IrcClient(account, getServerPassword(), ['echo-message'], { account, password: PASSWORD });
  await phone.connect();
});

test.afterEach(() => {
  phone?.disconnect();
  peer?.disconnect();
});

test.describe('Messages sent from another client of the same account', () => {
  test('a direct message sent from the phone shows in the app as ours, without an unread badge', async () => {
    phone.sendMessage(peer.nick, 'sent from my phone');
    await peer.waitForLine((line) => line.endsWith(`PRIVMSG ${peer.nick} :sent from my phone`));

    const channelNav = page.getByTestId('channels-sidebar');
    const peerButton = channelNav.getByRole('button', { name: peer.nick, exact: true });
    await expect(peerButton).toBeVisible({ timeout: 10_000 });
    await expect(peerButton.locator('..').locator('[aria-label*="unread"], [aria-label*="mention"]')).not.toBeVisible();

    await peerButton.click();
    const message = page.getByTestId('chat-log').locator('.sic-msg', { hasText: 'sent from my phone' });
    await expect(message.locator('.sic-msg-nick').first()).toHaveText(account);
  });

  test('the app does not answer a CTCP request the phone sent', async () => {
    const phoneLines = phone.captureLines();

    phone.send(`PRIVMSG ${peer.nick} :\x01VERSION\x01`);
    await peer.waitForLine((line) => line.includes(`PRIVMSG ${peer.nick} :\x01VERSION\x01`));

    // Once this shows, the app has handled the request before it
    phone.sendMessage(peer.nick, 'after the ctcp');
    await page.getByTestId('channels-sidebar').getByRole('button', { name: peer.nick, exact: true }).click();
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('after the ctcp')).toBeVisible({ timeout: 10_000 });

    // Anything the app sent in reply reaches the phone ahead of this
    const relayed = phone.waitForLine((line) => line.endsWith(':sent from the app'));
    const messageInput = page.locator('#message-input');
    await messageInput.fill('sent from the app');
    await messageInput.press('Enter');
    await relayed;
    phoneLines.stop();

    expect(phoneLines.lines.filter((line) => line.includes('\x01VERSION '))).toEqual([]);
  });
});
