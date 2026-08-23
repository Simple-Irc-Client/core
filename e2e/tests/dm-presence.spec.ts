import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let sharedPage: Page;
let bot: IrcClient | undefined;
// Both browser projects run this spec concurrently against the same ergo
// server; per-project nicks avoid 433 collisions.
let botNick: string;
let testerNick: string;
let chanNick: string;

test.beforeAll(async ({ browser }, testInfo) => {
  const suffix = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  botNick = `dmp-bot-${suffix}`;
  testerNick = `dmp-tester-${suffix}`;
  chanNick = `#dmp-chan-${suffix}`;

  bot = await createIrcClient(botNick);
  await bot.join(chanNick);

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, testerNick, { channels: [chanNick] });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot?.disconnect();
});

const channelNav = () => sharedPage.getByTestId('channels-sidebar');
const dmRow = () => channelNav().getByRole('button', { name: botNick, exact: true });
const headerName = () => sharedPage.getByTestId('chat-header-name');

test.describe('DM presence indicator', () => {
  test.describe.configure({ mode: 'serial' });

  test('receiving a DM shows the peer as online in the sidebar and the chat header', async () => {
    bot?.sendMessage(testerNick, 'Hello there!');

    await expect(dmRow()).toBeVisible({ timeout: 10_000 });
    // The bot is connected right now: the fresh MONITOR subscription should
    // resolve to online almost immediately.
    await expect(dmRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });

    await dmRow().click();
    await expect(headerName()).toContainText(botNick);
    await expect(headerName().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
  });

  test('a regular channel never shows a presence dot', async () => {
    await sharedPage.getByRole('button', { name: chanNick, exact: true }).click();

    await expect(headerName()).toContainText(chanNick);
    await expect(headerName().getByLabel('Online')).toHaveCount(0);
    await expect(headerName().getByLabel('Offline')).toHaveCount(0);

    const chanRow = channelNav().getByRole('button', { name: chanNick, exact: true });
    await expect(chanRow.getByLabel('Online')).toHaveCount(0);
    await expect(chanRow.getByLabel('Offline')).toHaveCount(0);
  });

  test('peer disconnecting flips the dot to offline', async () => {
    await dmRow().click();

    bot?.disconnect();
    bot = undefined;

    await expect(dmRow().getByLabel('Offline')).toBeVisible({ timeout: 10_000 });
    await expect(headerName().getByLabel('Offline')).toBeVisible({ timeout: 10_000 });
  });

  test('peer reconnecting flips the still-open window back to online', async () => {
    bot = await createIrcClient(botNick);

    await expect(dmRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
    await expect(headerName().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
  });

  test('closing the DM window and reopening it still tracks presence correctly', async () => {
    await dmRow().click();

    // Close the DM window (hover reveals the X, same interaction as private-messages.spec.ts)
    await sharedPage.mouse.move(0, 0);
    await dmRow().hover();
    await channelNav().getByRole('button', { name: `Leave ${botNick}` }).click();
    await expect(dmRow()).toBeHidden();

    // Bot cycles offline/online while no DM window is open — nothing to
    // assert visually here, this just proves the earlier unsubscribe didn't
    // leave the app (or the server-side MONITOR list) in a broken state.
    bot?.disconnect();
    bot = await createIrcClient(botNick);

    // Reopening the conversation re-subscribes from scratch and should reflect
    // the peer's current (online) status again.
    bot.sendMessage(testerNick, 'back again');

    await expect(dmRow()).toBeVisible({ timeout: 10_000 });
    await expect(dmRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
  });

  // Keep this test last: it renames the bot for the rest of the suite.
  test('peer renaming (NICK) moves the DM window and its presence dot to the new nick', async () => {
    // A NICK change is only ever delivered to clients sharing a channel with
    // the renaming user — MONITOR itself has no "renamed" notification, only
    // online/offline. Earlier tests disconnected/reconnected the bot without
    // rejoining, so make sure it's actually in `chanNick` with us again
    // before renaming, or the server has nobody to tell.
    await bot?.join(chanNick);
    await dmRow().click();
    await expect(headerName().getByLabel('Online')).toBeVisible({ timeout: 10_000 });

    const newNick = `${botNick}-renamed`;
    await bot?.changeNick(newNick);

    // The window itself must follow the rename (old row gone, new one in its place)...
    const renamedRow = channelNav().getByRole('button', { name: newNick, exact: true });
    await expect(renamedRow).toBeVisible({ timeout: 10_000 });
    await expect(channelNav().getByRole('button', { name: botNick, exact: true })).toBeHidden();

    // ...and so must the MONITOR subscription: still online, not "unknown" or stuck offline.
    await expect(renamedRow.getByLabel('Online')).toBeVisible({ timeout: 10_000 });
    await expect(headerName()).toContainText(newNick);
    await expect(headerName().getByLabel('Online')).toBeVisible({ timeout: 10_000 });

    botNick = newNick;
  });
});
