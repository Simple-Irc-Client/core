import { randomBytes } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { getServerPassword, projectTag } from '../helpers';
import { IRC_PORT, LEGACY_IRC_PORT, SOJU_WSS_PORT } from '../global-setup';
import { createSojuNetwork, createSojuUser, deleteSojuNetwork } from '../soju';
import { skipWithoutIrcv3 } from '../test-server';

// soju.im/bouncer-networks against a real soju, whose networks are the test IRC servers
const PASSWORD = 'bouncer-pass-42';

let bot: IrcClient;
/** On ngircd, the other network on the account */
let legacyBot: IrcClient;
let page: Page;
let account: string;
let nick: string;
let channel: string;

/** Through the nick and server steps to the bouncer's WebSocket */
const wizardToBouncer = async (onPage: Page): Promise<void> => {
  await onPage.getByLabel('Enter your nickname').fill(account);
  await onPage.getByRole('button', { name: 'Next' }).click();
  await onPage.getByLabel('Server address').fill('localhost');
  await onPage.getByLabel('Port').clear();
  await onPage.getByLabel('Port').fill(String(SOJU_WSS_PORT));
  await onPage.getByRole('button', { name: 'WebSocket' }).click();
  await onPage.getByRole('button', { name: 'Next' }).click();
};

test.beforeAll(async ({ browser }, testInfo) => {
  // One bouncer serves every project; the IRCv3 ones are enough to drive it
  skipWithoutIrcv3('one bouncer serves every project');
  const tag = projectTag(testInfo);
  // Accounts outlive a retried test; a fresh name per attempt
  account = `bnc-${tag}-${randomBytes(3).toString('hex')}`;
  nick = `bncnick-${tag}-${randomBytes(2).toString('hex')}`;
  channel = `#bnc-${tag}`;

  createSojuUser(account, PASSWORD);
  createSojuNetwork(account, { name: 'ergo-net', port: IRC_PORT, nick, serverPassword: getServerPassword() });
  createSojuNetwork(account, { name: 'legacy-net', port: LEGACY_IRC_PORT, nick, serverPassword: getServerPassword() });
  // Nothing listens there: the bouncer reports why it can't connect
  createSojuNetwork(account, { name: 'broken-net', port: 1, nick });

  bot = await createIrcClient(`bncbot-${tag}`);
  await bot.join(channel);
  legacyBot = await createIrcClient(`bnclegacy-${tag}`, '127.0.0.1', LEGACY_IRC_PORT);
  await legacyBot.join(channel);

  page = await browser.newPage();
  await page.goto('/');
});

test.afterAll(async () => {
  await page?.close();
  bot?.disconnect();
  legacyBot?.disconnect();
});

const joinFrom = async (ircBot: IrcClient): Promise<void> => {
  // ngircd sends the channel as a trailing parameter
  const joined = ircBot.waitForLine((line) => line.includes(`:${nick}!`) && (line.includes(`JOIN ${channel}`) || line.includes(`JOIN :${channel}`)));
  await page.locator('#message-input').fill(`/join ${channel}`);
  await page.locator('#message-input').press('Enter');
  await joined;
  await expect(page.getByTestId('chat-header-name')).toContainText(channel, { timeout: 10_000 });
};

test.describe('Bouncer networks', () => {
  test.describe.configure({ mode: 'serial' });

  test('a bouncer account lists its networks, and the one chosen is where the app chats', async () => {
    await wizardToBouncer(page);

    await expect(page.getByRole('heading', { name: 'Bouncer account' })).toBeVisible();
    await page.getByLabel('Username').fill(account);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'Choose a network' })).toBeVisible({ timeout: 20_000 });
    const ergoNet = page.getByRole('button', { name: /ergo-net/ });
    await expect(ergoNet).toContainText(`127.0.0.1:${IRC_PORT}`);
    await expect(ergoNet).toContainText('Connected', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /broken-net/ })).toContainText('connection refused', { timeout: 10_000 });

    await ergoNet.click();
    await page.getByText('Select a irc channel').waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.locator('#message-input').waitFor({ timeout: 10_000 });

    // The bouncer's connection to ergo is the one in the channel
    await joinFrom(bot);
  });

  test('after a reload the app logs in again and returns to the same network', async () => {
    await page.reload();
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    const said = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :back through the bouncer`));
    await page.getByRole('button', { name: channel, exact: true }).click();
    await page.locator('#message-input').fill('back through the bouncer');
    await page.locator('#message-input').press('Enter');
    expect(await said).toContain(`:${nick}!`);
  });

  test('switching to another network leaves the windows of the one before', async () => {
    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByRole('menuitem', { name: 'Bouncer networks' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /ergo-net/ })).toContainText('Current');
    await dialog.getByRole('button', { name: /legacy-net/ }).click();

    await expect(page.getByTestId('channels-sidebar').getByRole('button', { name: channel, exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 30_000 });
    await joinFrom(legacyBot);
  });

  test('when the bouncer no longer has the network, the user picks another', async () => {
    deleteSojuNetwork(account, 'legacy-net');
    await page.reload();
    await page.getByRole('button', { name: 'Connect' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('The bouncer no longer has the network you were on. Choose another one.')).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole('button', { name: /legacy-net/ })).toHaveCount(0);
    await dialog.getByRole('button', { name: /ergo-net/ }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 30_000 });
    const said = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :back on ergo`));
    await page.getByRole('button', { name: channel, exact: true }).click();
    await page.locator('#message-input').fill('back on ergo');
    await page.locator('#message-input').press('Enter');
    expect(await said).toContain(`:${nick}!`);
  });

  test('a wrong password is refused, and the user can go back and fix it', async ({ browser }) => {
    const other = await browser.newPage();
    try {
      await other.goto('/');
      await wizardToBouncer(other);
      await other.getByLabel('Username').fill(account);
      await other.getByLabel('Password').fill('not-the-password');
      await other.getByRole('button', { name: 'Next' }).click();

      await expect(other.getByRole('heading', { name: 'Disconnected' })).toBeVisible({ timeout: 20_000 });
      await expect(other.getByText('Authentication required')).toBeVisible();
      await other.getByRole('button', { name: 'Go Back' }).click();
      await expect(other.getByLabel('Enter your nickname')).toBeVisible();
    } finally {
      await other.close();
    }
  });
});
