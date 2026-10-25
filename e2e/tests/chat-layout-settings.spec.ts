import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, projectTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let channel: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

const closeSettings = async (): Promise<void> => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
};

const choose = async (testId: string, option: string): Promise<void> => {
  const select = page.getByTestId(testId);
  await select.click();
  await page.getByRole('option', { name: option }).click();
  // Escape before the Select hands focus back would close the Select, not the dialog
  await expect(select).toBeFocused();
};

/** The time the theme shows for a message, as the reader sees it */
const shownTime = (row: Locator): Promise<string> =>
  row.locator('.sic-msg-time').evaluateAll((times) => times.map((time) => (time as HTMLElement).innerText).find((text) => text !== '') ?? '');

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = projectTag(testInfo);
  channel = `#layout-${tag}`;

  bot = await createIrcClient(`layoutbot-${tag}`);
  await bot.join(channel);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, `layout-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  bot?.disconnect();
});

test.describe('Chat layout settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('message times follow the chosen format, with seconds when asked', async () => {
    bot.sendMessage(channel, 'what time is it');
    const row = messageRow('what time is it');
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    expect(await shownTime(row)).toMatch(/^\d{2}:\d{2}$/);

    await openProfileSettings(page, 'appearance');
    await choose('time-format-select', '12-hour (2:05 PM)');
    await page.getByTestId('show-seconds-toggle').click();
    await closeSettings();

    await expect.poll(() => shownTime(row)).toMatch(/^\d{1,2}:\d{2}:\d{2} (AM|PM)$/);
    await expect.poll(() => page.getByTestId('chat-log').evaluate((log) => (log as HTMLElement).style.getPropertyValue('--sic-time-width'))).toBe('11ch');
  });

  test('WHOIS shows when someone signed on in the chosen format', async () => {
    const input = page.locator('#message-input');
    await input.fill(`/whois ${bot.nick}`);
    await input.press('Enter');

    await expect(page.getByTestId('chat-log').getByText(/signed on/)).toContainText(/signed on \d{1,2} \w{3} \d{4} \d{1,2}:\d{2}:\d{2} (AM|PM)$/, { timeout: 10_000 });
  });

  test('compact spacing packs the messages closer', async () => {
    // From another speaker than the line above, so it starts a group
    const input = page.locator('#message-input');
    await input.fill('roomy line');
    await input.press('Enter');
    const row = messageRow('roomy line');
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    const paddingTop = (): Promise<number> => row.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop));
    const comfortable = await paddingTop();
    expect(comfortable).toBeGreaterThan(0);

    await openProfileSettings(page, 'appearance');
    await page.getByTestId('density-compact').click();
    await closeSettings();

    await expect(page.getByTestId('chat-log')).toHaveAttribute('data-density', 'compact');
    expect(await paddingTop()).toBeLessThan(comfortable);
  });

  test('the server lag can be hidden', async () => {
    const lag = page.getByTestId('channels-sidebar').getByTestId('lag-indicator');
    await expect(lag).toHaveText(/^\d+(ms|\.\ds)$/, { timeout: 40_000 });

    await openProfileSettings(page, 'appearance');
    await page.getByTestId('show-lag-toggle').click();
    await closeSettings();

    await expect(lag).toHaveCount(0);
  });

  test('auto away can be set to another time and message, or turned off', async () => {
    await openProfileSettings(page, 'profile');
    await choose('auto-away-select', 'After 5 min without sending');
    const message = page.getByLabel('Away message');
    await expect(message).toHaveAttribute('placeholder', 'Auto away - inactive for 5 min');
    await message.fill('gone fishing');
    await closeSettings();

    await openProfileSettings(page, 'profile');
    await expect(page.getByTestId('auto-away-select')).toHaveText('After 5 min without sending');
    await expect(page.getByLabel('Away message')).toHaveValue('gone fishing');

    await choose('auto-away-select', 'Off');
    await expect(page.getByLabel('Away message')).toHaveCount(0);
    await closeSettings();
  });
});
