import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let page: Page;
let bot: IrcClient | undefined;
let botNick: string;
let testerNick: string;
let chanNick: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  skipWithoutIrcv3('presence comes from MONITOR');
  const suffix = testTag(testInfo);
  botNick = `dmp-bot-${suffix}`;
  testerNick = `dmp-tester-${suffix}`;
  chanNick = `#dmp-chan-${suffix}`;

  bot = await createIrcClient(botNick);
  await bot.join(chanNick);

  await page.goto('/');
  await connectViaWizard(page, testerNick, { channels: [chanNick] });
});

test.afterEach(() => {
  bot?.disconnect();
});

const channelNav = () => page.getByTestId('channels-sidebar');
const dmRow = () => channelNav().getByRole('button', { name: botNick, exact: true });
const headerName = () => page.getByTestId('chat-header-name');

/** The bot writes to us, and we open the window of that conversation */
const openDmFromBot = async (): Promise<void> => {
  bot?.sendMessage(testerNick, 'Hello there!');
  await dmRow().click({ timeout: 10_000 });
  await expect(headerName()).toContainText(botNick);
};

test.describe('DM presence indicator', () => {
  test('receiving a DM shows the peer as online in the sidebar', async () => {
    bot?.sendMessage(testerNick, 'Hello there!');

    await expect(dmRow()).toBeVisible({ timeout: 10_000 });
    // The bot is connected right now: the fresh MONITOR subscription should
    // resolve to online almost immediately.
    await expect(dmRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });

    await dmRow().click();
    await expect(headerName()).toContainText(botNick);
  });

  test('a regular channel never shows a presence dot', async () => {
    await page.getByRole('button', { name: chanNick, exact: true }).click();

    await expect(headerName()).toContainText(chanNick);

    const chanRow = channelNav().getByRole('button', { name: chanNick, exact: true });
    await expect(chanRow.getByLabel('Online')).toHaveCount(0);
    await expect(chanRow.getByLabel('Offline')).toHaveCount(0);
  });

  test('peer disconnecting flips the dot to offline', async () => {
    await openDmFromBot();

    bot?.disconnect();
    bot = undefined;

    await expect(dmRow().getByLabel('Offline')).toBeVisible({ timeout: 10_000 });
  });

  test('peer reconnecting flips the still-open window back to online', async () => {
    await openDmFromBot();
    bot?.disconnect();
    await expect(dmRow().getByLabel('Offline')).toBeVisible({ timeout: 10_000 });

    bot = await createIrcClient(botNick);

    await expect(dmRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
  });

  test('closing the DM window and reopening it still tracks presence correctly', async () => {
    await openDmFromBot();

    // Close the DM window (hover reveals the X, same interaction as private-messages.spec.ts)
    await page.mouse.move(0, 0);
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

  test('peer renaming (NICK) moves the DM window and its presence dot to the new nick', async () => {
    // A NICK change reaches only those sharing a channel with the bot (MONITOR has no "renamed" notification), as chanNick does
    await openDmFromBot();
    await expect(dmRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });

    const newNick = `${botNick}-renamed`;
    await bot?.changeNick(newNick);

    // The window itself must follow the rename (old row gone, new one in its place)...
    const renamedRow = channelNav().getByRole('button', { name: newNick, exact: true });
    await expect(renamedRow).toBeVisible({ timeout: 10_000 });
    await expect(channelNav().getByRole('button', { name: botNick, exact: true })).toBeHidden();

    // ...and so must the MONITOR subscription: still online, not "unknown" or stuck offline.
    await expect(renamedRow.getByLabel('Online')).toBeVisible({ timeout: 10_000 });
    await expect(headerName()).toContainText(newNick);
  });
});
