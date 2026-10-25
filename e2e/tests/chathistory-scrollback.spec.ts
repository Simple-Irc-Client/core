import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

const LINES = 120;

let bot: IrcClient;
let page: Page;
let nick: string;
let channel: string;

const lineText = (number: number): string => `history line ${String(number).padStart(3, '0')}`;

const historyLines = (): Locator => page.getByTestId('chat-log').locator('.sic-msg').filter({ hasText: /history line \d{3}/ });

const shownLineNumbers = async (): Promise<number[]> =>
  (await historyLines().allInnerTexts()).map((text) => Number(/history line (\d{3})/.exec(text)?.[1]));

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  skipWithoutIrcv3('history is fetched with draft/chathistory');
  const tag = testTag(testInfo);
  nick = `scrolluser-${tag}`;
  channel = `#scrollback-${tag}`;

  bot = await createIrcClient(`scrollbot-${tag}`, undefined, undefined, ['echo-message']);
  await bot.join(channel);
  const lastStored = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :${lineText(LINES)}`));
  for (let number = 1; number <= LINES; number++) {
    bot.sendMessage(channel, lineText(number));
  }
  await lastStored;

  await page.goto('/');
  await connectViaWizard(page, nick, { channels: [channel] });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Scrolling back through chat history', () => {
  test('a joined channel shows its latest history in order, above our own join', async () => {
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(lineText(LINES), { exact: true })).toBeVisible({ timeout: 10_000 });

    const shown = await shownLineNumbers();
    expect(shown.length).toBeLessThan(LINES);
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
    expect(shown.at(-1)).toBe(LINES);

    const texts = await chatLog.locator('.sic-msg').allInnerTexts();
    expect(texts.findLastIndex((text) => text.includes(`${nick} has joined`))).toBeGreaterThan(texts.findIndex((text) => text.includes(lineText(LINES))));
  });

  test('scrolling to the top loads older messages without moving the view, back to the start of history', async () => {
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(lineText(LINES), { exact: true })).toBeVisible({ timeout: 10_000 });
    const [firstShown = 0] = await shownLineNumbers();
    expect(firstShown).toBeGreaterThan(1);
    const firstLine = chatLog.getByText(lineText(firstShown), { exact: true });

    // Measured in the same task as the scroll, before the app can react to it
    const topBefore = await chatLog.evaluate((element, text) => {
      element.scrollTop = 0;
      const line = [...element.querySelectorAll('.sic-msg')].find((message) => message.textContent?.includes(text));
      return line?.getBoundingClientRect().top;
    }, lineText(firstShown));
    await expect(chatLog.getByText(lineText(firstShown - 1), { exact: true })).toBeAttached({ timeout: 10_000 });
    // The older page went in above what was being read
    const topAfter = await firstLine.evaluate((line) => line.closest('.sic-msg')?.getBoundingClientRect().top);
    expect(Math.abs((topAfter ?? Number.NaN) - (topBefore ?? Number.NaN))).toBeLessThanOrEqual(2);

    await expect(async () => {
      await chatLog.evaluate((element) => { element.scrollTop = 0; });
      await expect(chatLog.getByText(lineText(1), { exact: true })).toBeAttached({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    expect(await shownLineNumbers()).toEqual(Array.from({ length: LINES }, (_, index) => index + 1));
  });
});
