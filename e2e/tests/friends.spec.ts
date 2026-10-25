import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let page: Page;
let bot: IrcClient | undefined;
let botNick: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const suffix = testTag(testInfo);
  botNick = `fr-bot-${suffix}`;

  await page.goto('/');
  await connectViaWizard(page, `fr-tester-${suffix}`);
});

test.afterEach(() => {
  bot?.disconnect();
});

const friendsSection = () => page.getByTestId('friends-section');
const friendRow = () => friendsSection().getByRole('button', { name: botNick, exact: true });

const addFriend = async (): Promise<void> => {
  await friendsSection().getByRole('button', { name: 'Add friend' }).click();
  await page.getByRole('textbox', { name: 'Nick' }).fill(botNick);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(friendRow()).toBeVisible({ timeout: 5_000 });
};

test.describe('Friends list', () => {
  test('adding a friend via the sidebar dialog shows them as offline', async () => {
    await addFriend();

    await expect(friendRow().getByLabel('Offline')).toBeVisible();
  });

  test('rejects an invalid nick in the dialog', async () => {
    await friendsSection().getByRole('button', { name: 'Add friend' }).click();
    await page.getByRole('textbox', { name: 'Nick' }).fill('bad nick');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('Invalid nick');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Nick' })).toBeHidden();
  });

  test('friend is shown online when they connect', async () => {
    skipWithoutIrcv3('presence comes from MONITOR');
    await addFriend();
    bot = await createIrcClient(botNick);

    await expect(friendRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a friend opens a private conversation', async () => {
    await addFriend();
    await friendRow().click();

    // The main input now targets the friend's priv window
    await expect(page.getByRole('textbox', { name: new RegExp(botNick) })).toBeVisible({ timeout: 5_000 });
  });

  test('friend is shown offline when they disconnect', async () => {
    skipWithoutIrcv3('presence comes from MONITOR');
    bot = await createIrcClient(botNick);
    await addFriend();
    await expect(friendRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });

    bot.disconnect();
    bot = undefined;

    await expect(friendRow().getByLabel('Offline')).toBeVisible({ timeout: 10_000 });
  });

  test('friends persist across reload and resubscribe on reconnect', async () => {
    skipWithoutIrcv3('presence comes from MONITOR');
    await addFriend();
    bot = await createIrcClient(botNick);

    await page.reload();

    // Persisted list renders (offline) before the connection is up
    await expect(friendRow()).toBeVisible({ timeout: 10_000 });
    await expect(friendRow().getByLabel('Offline')).toBeVisible();

    // Reconnect: online status must come from a fresh MONITOR subscription
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(friendRow().getByLabel('Online')).toBeVisible({ timeout: 20_000 });
  });

  test('removing a friend deletes it from the list', async () => {
    await addFriend();
    await friendRow().hover();
    await friendsSection().getByRole('button', { name: `Remove ${botNick} from friends` }).click();

    await expect(friendRow()).toBeHidden();
  });
});
