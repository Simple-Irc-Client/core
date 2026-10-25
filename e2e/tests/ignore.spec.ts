import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, testTag } from '../helpers';

let troll: IrcClient;
let friend: IrcClient;
let page: Page;
let channel: string;
let trollNick: string;
let userNick: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

const openUserMenu = async (nick: string): Promise<void> => {
  await page.getByTestId('users-sidebar').getByText(nick, { exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
};

const openSettings = async (): Promise<void> => {
  await openProfileSettings(page, 'privacy');
};

const ignoreTrollFromUserMenu = async (): Promise<void> => {
  await openUserMenu(trollNick);
  await page.getByRole('menuitem', { name: 'Ignore' }).click();
  await expect(page.getByRole('menu')).toBeHidden();
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  channel = `#ignore-${tag}`;
  trollNick = `troll-${tag}`;
  userNick = `ignorer-${tag}`;

  troll = await createIrcClient(trollNick);
  friend = await createIrcClient(`pal-${tag}`);
  await troll.join(channel);
  await friend.join(channel);

  await page.goto('/');
  await connectViaWizard(page, userNick, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.getByTestId('users-sidebar').getByText(trollNick, { exact: true })).toBeVisible({ timeout: 10_000 });
});

test.afterEach(() => {
  troll?.disconnect();
  friend?.disconnect();
});

test.describe('Ignore', () => {
  test('ignoring from the user menu hides their channel and private messages', async () => {
    await ignoreTrollFromUserMenu();

    troll.sendMessage(channel, 'channel spam');
    troll.sendMessage(userNick, 'private spam');
    friend.sendMessage(channel, 'a friendly line');

    await expect(messageRow('a friendly line')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow('channel spam')).toHaveCount(0);
    await expect(page.getByRole('button', { name: trollNick, exact: true })).toHaveCount(0);
  });

  test('the user menu offers to stop ignoring, and the settings list the mask', async () => {
    await ignoreTrollFromUserMenu();

    await openUserMenu(trollNick);
    await expect(page.getByRole('menuitem', { name: 'Stop ignoring' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Ignore' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await openSettings();
    await expect(page.getByTestId('ignored-list')).toHaveText(`${trollNick}!*@*`);
  });

  test('removing the mask in the settings shows their messages again', async () => {
    await ignoreTrollFromUserMenu();
    await openSettings();
    await page.getByRole('button', { name: `Stop ignoring ${trollNick}!*@*` }).click();
    await expect(page.getByTestId('ignored-list')).toHaveCount(0);
    await page.keyboard.press('Escape');

    troll.sendMessage(channel, 'talking again');
    await expect(messageRow('talking again')).toHaveCount(1, { timeout: 10_000 });
  });

  test('/ignore ignores a mask, and /unignore stops it', async () => {
    const input = page.locator('#message-input');
    await input.fill(`/ignore ${trollNick}!*@*`);
    await input.press('Enter');
    await expect(page.getByTestId('chat-log').getByText(`Ignoring ${trollNick}!*@*.`)).toBeVisible();

    troll.sendMessage(channel, 'ignored by command');
    friend.sendMessage(channel, 'second friendly line');
    await expect(messageRow('second friendly line')).toHaveCount(1, { timeout: 10_000 });
    await expect(messageRow('ignored by command')).toHaveCount(0);

    await input.fill(`/unignore ${trollNick}`);
    await input.press('Enter');
    await expect(page.getByTestId('chat-log').getByText(`No longer ignoring ${trollNick}!*@*.`)).toBeVisible();
    troll.sendMessage(channel, 'heard by command');
    await expect(messageRow('heard by command')).toHaveCount(1, { timeout: 10_000 });
  });
});
