import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let sharedPage: Page;
let bot: IrcClient | undefined;
// Both browser projects run this spec concurrently against the same ergo
// server; per-project nicks avoid 433 collisions.
let botNick: string;

test.beforeAll(async ({ browser }, testInfo) => {
  const suffix = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  botNick = `fr-bot-${suffix}`;

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, `fr-tester-${suffix}`);
});

test.afterAll(async () => {
  await sharedPage.close();
  bot?.disconnect();
});

const friendsSection = () => sharedPage.getByTestId('friends-section');
const friendRow = () => friendsSection().getByRole('button', { name: botNick, exact: true });

test.describe('Friends list', () => {
  test.describe.configure({ mode: 'serial' });

  test('adding a friend via the sidebar dialog shows them as offline', async () => {
    await friendsSection().getByRole('button', { name: 'Add friend' }).click();
    await sharedPage.getByRole('textbox', { name: 'Nick' }).fill(botNick);
    await sharedPage.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(friendRow()).toBeVisible({ timeout: 5_000 });
    await expect(friendRow().getByLabel('Offline')).toBeVisible();
  });

  test('rejects an invalid nick in the dialog', async () => {
    await friendsSection().getByRole('button', { name: 'Add friend' }).click();
    await sharedPage.getByRole('textbox', { name: 'Nick' }).fill('bad nick');
    await sharedPage.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(sharedPage.getByRole('alert')).toHaveText('Invalid nick');

    await sharedPage.keyboard.press('Escape');
    await expect(sharedPage.getByRole('textbox', { name: 'Nick' })).toBeHidden();
  });

  test('friend is shown online when they connect', async () => {
    bot = await createIrcClient(botNick);

    await expect(friendRow().getByLabel('Online')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a friend opens a private conversation', async () => {
    await friendRow().click();

    // The main input now targets the friend's priv window
    await expect(sharedPage.getByRole('textbox', { name: new RegExp(botNick) })).toBeVisible({ timeout: 5_000 });
  });

  test('friend is shown offline when they disconnect', async () => {
    bot?.disconnect();
    bot = undefined;

    await expect(friendRow().getByLabel('Offline')).toBeVisible({ timeout: 10_000 });
  });

  test('friends persist across reload and resubscribe on reconnect', async () => {
    bot = await createIrcClient(botNick);

    await sharedPage.reload();

    // Persisted list renders (offline) before the connection is up
    await expect(friendRow()).toBeVisible({ timeout: 10_000 });
    await expect(friendRow().getByLabel('Offline')).toBeVisible();

    // Reconnect: online status must come from a fresh MONITOR subscription
    await sharedPage.getByRole('button', { name: 'Connect' }).click();
    await expect(friendRow().getByLabel('Online')).toBeVisible({ timeout: 20_000 });
  });

  test('removing a friend deletes it from the list', async () => {
    await friendRow().hover();
    await friendsSection().getByRole('button', { name: `Remove ${botNick} from friends` }).click();

    await expect(friendRow()).toBeHidden();
  });
});
