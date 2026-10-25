import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, projectTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let page: Page;
let holder: IrcClient;
let wanted: string;

const banner = () => page.getByTestId('nick-regain-banner');
const currentNick = () => page.locator('[data-avatar-button]');
const persistedNick = (): Promise<string | undefined> => page.evaluate(() => JSON.parse(localStorage.getItem('sic-settings') ?? '{}').state?.nick);

/** Resolves once the server has no one on `nick` any more */
const waitUntilFree = async (nick: string): Promise<void> => {
  const observer = await createIrcClient(`${nick}-w`);
  try {
    await expect.poll(async () => {
      const reply = observer.waitForLine((line) => / 303 /.test(line));
      observer.send(`ISON ${nick}`);
      return (await reply).slice((await reply).lastIndexOf(':') + 1).trim();
    }).toBe('');
  } finally {
    observer.disconnect();
  }
};

/** A WHOIS typed in the app, answered: the server has handled what the app sent before it, and the app what came before the answer */
const appRoundTrip = async (marker: string): Promise<void> => {
  const input = page.locator('#message-input');
  await input.fill(`/whois ${marker}`);
  await input.press('Enter');
  await expect(page.getByTestId('chat-log').getByText(marker).first()).toBeVisible({ timeout: 10_000 });
};

test.beforeEach(async ({ browser }, testInfo) => {
  const tag = projectTag(testInfo);
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
    await expect.poll(persistedNick).toBe(wanted);
  });

  test('settles for the alternative when asked', async () => {
    await expect(banner()).toBeVisible();

    await banner().getByRole('button', { name: `Stay ${wanted}_` }).click();

    await expect(banner()).toBeHidden();
    holder.disconnect();
    await waitUntilFree(wanted);

    // The first answer comes after anything the app did about the nick freeing up, the second after the server's reply to it
    await appRoundTrip(`${wanted}-s1`);
    await appRoundTrip(`${wanted}-s2`);
    expect(await persistedNick()).toBe(`${wanted}_`);
  });
});
