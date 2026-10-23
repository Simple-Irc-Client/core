import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let friend: IrcClient;
let page: Page;
let first: string;
let second: string;

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  first = `#switch-one-${tag}`;
  second = `#switch-two-${tag}`;
  const userNick = `switcher-${tag}`;

  friend = await createIrcClient(`nudger-${tag}`);
  // The wizard picks channels from the server's list, so they must exist
  await friend.join(first);
  await friend.join(second);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, userNick, { channels: [first, second] });
  await page.getByRole('button', { name: first, exact: true }).click();
  await expect(page.getByTestId('chat-header-name')).toHaveText(first);

  friend.sendMessage(userNick, 'over here');
  await expect(page.getByRole('button', { name: friend.nick, exact: true })).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  friend?.disconnect();
});

test.describe('Quick switcher', () => {
  test.describe.configure({ mode: 'serial' });

  test('lists the unread conversation first, and the current channel last', async () => {
    await page.locator('#message-input').press('ControlOrMeta+k');

    const options = page.getByTestId('quick-switcher').getByRole('option');
    await expect(options.first()).toContainText(friend.nick);
    await expect(options.last()).toHaveText(first);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quick-switcher')).toBeHidden();
  });

  test('typing part of a name and pressing Enter switches to that window', async () => {
    await page.locator('#message-input').press('ControlOrMeta+k');
    await page.getByRole('combobox', { name: 'Switch window' }).fill('two');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('quick-switcher')).toBeHidden();
    await expect(page.getByTestId('chat-header-name')).toHaveText(second);
  });

  test('the shortcuts list opens with Ctrl+/ and from the user menu', async () => {
    await page.locator('#message-input').press('ControlOrMeta+/');
    await expect(page.getByTestId('shortcuts-list')).toContainText('Switch to a channel or conversation');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcuts-list')).toBeHidden();

    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Keyboard shortcuts' }).click();
    await expect(page.getByTestId('shortcuts-list')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
