import { randomBytes } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, IrcClient } from '../irc-client';
import { connectViaWizard, getServerPassword } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

// ergo's multiclient stands in for a bouncer: the app and a "phone" are two sessions of one account
const PASSWORD = 'phone-and-app-42';

let account: string;
let peer: IrcClient;
let phone: IrcClient;
let sharedPage: Page;

const registerMulticlientAccount = async (): Promise<void> => {
  const registrar = new IrcClient(account, getServerPassword());
  await registrar.connect();
  const created = registrar.waitForLine((line) => line.includes('Account created'));
  registrar.sendMessage('NickServ', `REGISTER ${PASSWORD}`);
  await created;
  const multiclient = registrar.waitForLine((line) => line.includes('Multiclient functionality is currently enabled'));
  registrar.sendMessage('NickServ', 'SET MULTICLIENT ON');
  await multiclient;
  // The app takes this nick next
  const closed = registrar.waitForLine((line) => line.startsWith('ERROR'));
  registrar.disconnect();
  await closed;
};

test.beforeAll(async ({ browser }, testInfo) => {
  skipWithoutIrcv3('ergo multiclient stands in for a bouncer');
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  // Accounts outlive a retried test; a fresh name per attempt
  account = `selfmsg-${tag}-${randomBytes(3).toString('hex')}`;

  await registerMulticlientAccount();
  peer = await createIrcClient(`selfpeer-${tag}`);

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, account);

  const messageInput = sharedPage.locator('#message-input');
  await messageInput.fill(`/msg NickServ IDENTIFY ${account} ${PASSWORD}`);
  await messageInput.press('Enter');
  await expect(sharedPage.getByText(`You're now logged in as ${account}`)).toBeVisible({ timeout: 10_000 });

  phone = new IrcClient(account, getServerPassword(), ['echo-message'], { account, password: PASSWORD });
  await phone.connect();
});

test.afterAll(async () => {
  await sharedPage?.close();
  phone?.disconnect();
  peer?.disconnect();
});

test.describe('Messages sent from another client of the same account', () => {
  test.describe.configure({ mode: 'serial' });

  test('a direct message sent from the phone shows in the app as ours, without an unread badge', async () => {
    phone.sendMessage(peer.nick, 'sent from my phone');
    await peer.waitForLine((line) => line.endsWith(`PRIVMSG ${peer.nick} :sent from my phone`));

    const channelNav = sharedPage.getByTestId('channels-sidebar');
    const peerButton = channelNav.getByRole('button', { name: peer.nick, exact: true });
    await expect(peerButton).toBeVisible({ timeout: 10_000 });
    await expect(peerButton.locator('..').locator('[aria-label*="unread"], [aria-label*="mention"]')).not.toBeVisible();

    await peerButton.click();
    const message = sharedPage.getByTestId('chat-log').locator('.sic-msg', { hasText: 'sent from my phone' });
    await expect(message.locator('.sic-msg-nick').first()).toHaveText(account);
  });

  test('the app does not answer a CTCP request the phone sent', async () => {
    const phoneLines = phone.captureLines();

    phone.send(`PRIVMSG ${peer.nick} :\x01VERSION\x01`);
    await peer.waitForLine((line) => line.includes(`PRIVMSG ${peer.nick} :\x01VERSION\x01`));

    // Once this shows, the app has handled the request before it
    phone.sendMessage(peer.nick, 'after the ctcp');
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('after the ctcp')).toBeVisible({ timeout: 10_000 });

    // Anything the app sent in reply reaches the phone ahead of this
    const relayed = phone.waitForLine((line) => line.endsWith(':sent from the app'));
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('sent from the app');
    await messageInput.press('Enter');
    await relayed;
    phoneLines.stop();

    expect(phoneLines.lines.filter((line) => line.includes('\x01VERSION '))).toEqual([]);
  });
});
