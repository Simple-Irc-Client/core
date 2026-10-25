import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, projectTag } from '../helpers';

let friend: IrcClient;
let page: Page;
let first: string;
let second: string;
let userNick: string;

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = projectTag(testInfo);
  first = `#search-one-${tag}`;
  second = `#search-two-${tag}`;
  userNick = `searcher-${tag}`;

  friend = await createIrcClient(`finder-${tag}`);
  // The wizard picks channels from the server's list, so they must exist
  await friend.join(first);
  await friend.join(second);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, userNick, { channels: [first, second] });

  // Each after the one before is in, so none share a timestamp
  await page.getByRole('button', { name: second, exact: true }).click();
  friend.sendMessage(second, 'the release is on Friday');
  // Enough after it that it scrolls out of view
  for (let i = 0; i < 40; i++) {
    friend.sendMessage(second, `filler line ${i}`);
  }
  await expect(page.getByTestId('chat-log')).toContainText('filler line 39');

  await page.getByRole('button', { name: first, exact: true }).click();
  friend.sendMessage(first, 'is the RELEASE ready?');
  await expect(page.getByTestId('chat-log')).toContainText('is the RELEASE ready?');

  friend.sendMessage(userNick, 'release notes are \x0314,14secret for now\x03');
  await expect(page.getByRole('button', { name: friend.nick, exact: true })).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  friend?.disconnect();
});

test.describe('Message search', () => {
  test.describe.configure({ mode: 'serial' });

  const search = () => page.getByTestId('message-search');
  const results = () => search().getByRole('option');

  test('lists the matches from every open window, newest first, keeping spoilers hidden', async () => {
    await page.locator('#message-input').press('ControlOrMeta+Shift+F');
    await search().getByRole('combobox').fill('release');

    await expect(results()).toHaveCount(3);
    await expect(results().nth(0)).toContainText('release notes are ▒▒▒');
    await expect(results().nth(0)).not.toContainText('secret');
    await expect(results().nth(1)).toContainText(first);
    await expect(results().nth(2)).toContainText(second);
    await expect(results().nth(2).locator('mark')).toHaveText('release');
  });

  test('picking a result shows the message in its window', async () => {
    await results().nth(2).click();

    await expect(search()).toBeHidden();
    await expect(page.getByTestId('chat-header-name')).toHaveText(second);
    const found = page.getByTestId('chat-log').locator('.sic-msg', { hasText: 'the release is on Friday' });
    await expect(found).toBeInViewport();
    await expect(found).toHaveAttribute('data-shown', '');
  });

  test('opens from the header too, and searches only the current window when asked', async () => {
    await page.getByRole('button', { name: 'Search messages' }).click();
    await search().getByRole('combobox').fill('release');
    await expect(results()).toHaveCount(3);

    await search().getByRole('switch', { name: `Only in ${second}` }).click();

    await expect(results()).toHaveCount(1);
    await expect(results()).toContainText('the release is on Friday');
  });

  test('says when nothing matches', async () => {
    await search().getByRole('combobox').fill('no such words');

    await expect(results()).toHaveCount(0);
    await expect(search()).toContainText('No matching messages');
    await page.keyboard.press('Escape');
    await expect(search()).toBeHidden();
  });
});
