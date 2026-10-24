import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let greeter: IrcClient;
let page: Page;
let greeted: string;
let viewing: string;
let userNick: string;

const openWindow = async (name: string): Promise<void> => {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('chat-header-name')).toHaveText(name);
};

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  greeted = `#greeted-${tag}`;
  viewing = `#viewing-${tag}`;
  userNick = `routed-${tag}`;

  greeter = await createIrcClient(`greeter-${tag}`);
  await greeter.join(greeted);
  await greeter.join(viewing);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, userNick, { channels: [greeted, viewing] });
  await openWindow(viewing);
});

test.afterAll(async () => {
  await page?.close();
  greeter?.disconnect();
});

test.describe('Notice routing', () => {
  test.describe.configure({ mode: 'serial' });

  test('a channel greeting sent to us shows in that channel, not the one being viewed', async () => {
    greeter.sendNotice(userNick, `[${greeted}] Welcome, read the rules`);
    greeter.sendMessage(viewing, 'marker line');
    await expect(page.getByTestId('chat-log').getByText('marker line')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('chat-log').getByText('Welcome, read the rules')).toHaveCount(0);

    await openWindow(greeted);
    await expect(page.getByTestId('chat-log').getByText(`[${greeted}] Welcome, read the rules`)).toBeVisible();
  });

  test('a NickServ answer shows where its command was typed, and not in Status', async () => {
    skipWithoutIrcv3('the legacy server has no services');
    const input = page.locator('#message-input');
    await input.fill('/ns help');
    await input.press('Enter');

    const answer = page.getByTestId('chat-log').locator('.sic-msg[data-category="notice"]', { hasText: 'NickServ' }).first();
    await expect(answer).toBeVisible({ timeout: 10_000 });

    await openWindow('Status');
    await expect(page.getByTestId('chat-log').locator('.sic-msg[data-category="notice"]', { hasText: 'NickServ' })).toHaveCount(0);
  });
});
