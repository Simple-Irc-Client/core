import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let page: Page;
let holder: IrcClient;
let wanted: string;

const banner = () => page.getByTestId('nick-regain-banner');
const currentNick = () => page.locator('[data-avatar-button]');

test.beforeEach(async ({ browser }, testInfo) => {
  // Each browser project runs this at once on the same server: names of its own keep them apart
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  wanted = `regain-${tag}-${testInfo.title.length}`;

  // Another session, as on the user's other device, holds the nick
  holder = await createIrcClient(wanted);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, wanted);
});

test.afterEach(async () => {
  await page?.close();
  holder?.disconnect();
});

test.describe('A nick in use', () => {
  test('connects under an alternative and says the nick is taken', async () => {
    await expect(banner()).toContainText(`${wanted} is in use`);
    await expect(banner()).toContainText(`You are ${wanted}_`);
    await expect(page.getByTestId('chat-log').getByText(`${wanted} is already in use; connecting as ${wanted}_`)).toBeVisible();
  });

  test('takes the nick back by itself once the other session lets go of it', async () => {
    skipWithoutIrcv3('ngircd has neither MONITOR nor WATCH to tell when the nick is free');
    await expect(banner()).toBeVisible();

    holder.disconnect();

    await expect(banner()).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('users-sidebar').getByText(wanted, { exact: true }).or(currentNick())).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sic-settings') ?? '{}').state?.nick)).toBe(wanted);
  });

  test('settles for the alternative when asked', async () => {
    await expect(banner()).toBeVisible();

    await banner().getByRole('button', { name: `Stay ${wanted}_` }).click();

    await expect(banner()).toBeHidden();
    holder.disconnect();
    await page.waitForTimeout(1500);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sic-settings') ?? '{}').state?.nick)).toBe(`${wanted}_`);
  });
});
