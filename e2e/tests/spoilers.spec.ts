import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let page: Page;
let channel: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#spoilers-${tag}`;

  bot = await createIrcClient(`spoilbot-${tag}`);
  await bot.join(channel);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, `spoiluser-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  bot?.disconnect();
});

test.describe('Spoilers', () => {
  test.describe.configure({ mode: 'serial' });

  test('text in its own background color stays covered until clicked', async () => {
    bot.sendMessage(channel, 'whodunit: \x0301,01the butler\x03 of course');

    const row = messageRow('whodunit');
    const spoiler = row.locator('.sic-spoiler');
    await expect(spoiler).toHaveCount(1, { timeout: 10_000 });
    await expect(spoiler).toHaveAttribute('role', 'button');
    await expect(spoiler).not.toHaveAttribute('data-revealed');
    // Hidden from screen readers too, until revealed
    await expect(spoiler.locator('[aria-hidden="true"]')).toHaveText('the butler');

    await spoiler.click();

    await expect(spoiler).toHaveAttribute('data-revealed');
    await expect(spoiler).not.toHaveAttribute('role');
    await expect(spoiler).toHaveText('the butler');
    await expect(spoiler.locator('[aria-hidden]')).toHaveCount(0);
    const colors = await spoiler.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(colors.color).not.toBe(colors.background);
  });

  test('||text|| typed in the input is sent covered', async () => {
    const received = bot.waitForLine((line) => line.includes(`PRIVMSG ${channel} :the end: `));

    const input = page.locator('#message-input');
    await input.fill('the end: ||he dies|| 2 times');
    await input.press('Enter');

    expect(await received).toContain(`PRIVMSG ${channel} :the end: \x0314,14he dies\x03 2 times`);
    const spoiler = messageRow('the end:').locator('.sic-spoiler');
    await expect(spoiler).toHaveCount(1, { timeout: 10_000 });
    await expect(spoiler).not.toHaveAttribute('data-revealed');

    await spoiler.press('Enter');
    await expect(spoiler).toHaveText('he dies');
  });

  test('replying to a spoiler keeps it covered above the input', async () => {
    bot.sendMessage(channel, 'the twist: \x0301,01they were twins\x03');
    const row = messageRow('the twist:');
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.hover();
    await row.getByRole('button', { name: 'Reply', exact: true }).click();

    const replyBar = page.getByText(/^Replying to /);
    await expect(replyBar).toContainText('the twist: ▒▒▒');
    await expect(replyBar).not.toContainText('twins');
    await page.locator('#message-input').press('Escape');
  });

  test('a link hidden in a spoiler gets no preview to give it away', async () => {
    bot.sendMessage(channel, 'the video: \x0301,01https://youtu.be/dQw4w9WgXcQ\x03 and https://youtu.be/jNQXAC9IVRw');
    const row = messageRow('the video:');
    await expect(row.locator('.sic-spoiler')).toHaveCount(1, { timeout: 10_000 });

    const previews = row.locator('.sic-msg-embeds a');
    await expect(previews).toHaveCount(1);
    await expect(previews).toHaveAttribute('href', 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  });
});
