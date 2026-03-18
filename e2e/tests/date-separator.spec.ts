import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('datebot');
  await bot.join('#date-sep');

  sharedPage = await browser.newPage();

  // Override Date so we can shift message timestamps near midnight.
  // - new Date() (no-arg) and Date.now() are shifted by __dateOffset.
  // - new Date(string) is shifted too (needed because server-time tags
  //   carry real timestamps — the offset makes them appear near midnight).
  // - new Date(number) and multi-arg forms pass through unchanged so that
  //   date-fns internal cloning (new Date(date.getTime())) doesn't double-shift.
  await sharedPage.addInitScript(`
    (function() {
      var OrigDate = Date;
      var origNow = Date.now.bind(Date);
      var offset = 0;

      Object.defineProperty(window, '__dateOffset', {
        get: function() { return offset; },
        set: function(v) { offset = v; }
      });
      Object.defineProperty(window, '__origNow', { value: origNow });
      Object.defineProperty(window, '__OrigDate', { value: OrigDate });

      var NewDate = function Date() {
        if (arguments.length === 0) {
          return new OrigDate(origNow() + offset);
        }
        if (arguments.length === 1 && typeof arguments[0] === 'string') {
          return new OrigDate(OrigDate.parse(arguments[0]) + offset);
        }
        return new (Function.prototype.bind.apply(OrigDate, [null].concat(Array.prototype.slice.call(arguments))))();
      };
      NewDate.now = function() { return origNow() + offset; };
      NewDate.parse = OrigDate.parse;
      NewDate.UTC = OrigDate.UTC;
      NewDate.prototype = OrigDate.prototype;
      globalThis.Date = NewDate;
    })();
  `);

  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'date-tester', { channels: ['#date-sep'] });
  await sharedPage.getByRole('button', { name: '#date-sep', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Date separator', () => {
  test.describe.configure({ mode: 'serial' });

  test('no separator between messages from the same day', async () => {
    // Send two messages on the same day
    bot.sendMessage('#date-sep', 'Same day message 1');
    bot.sendMessage('#date-sep', 'Same day message 2');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Same day message 1')).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText('Same day message 2')).toBeVisible({ timeout: 10_000 });

    // No date separator should exist between same-day messages
    await expect(chatLog.locator('[role="separator"]')).not.toBeVisible();
  });

  test('separator appears between messages from different days', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Shift the clock so that "now" is ~5 seconds before the next midnight.
    // This also shifts parsed server-time timestamps, so the next message
    // the bot sends will appear as just before midnight.
    await sharedPage.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = globalThis as any;
      const now: number = w.__origNow();
      const midnight = new w.__OrigDate(now);
      midnight.setHours(24, 0, 0, 0);
      w.__dateOffset = midnight.getTime() - 5000 - now;
    });

    // Send a message — its server-time will be shifted to ~5s before midnight
    bot.sendMessage('#date-sep', 'Before midnight message');
    await expect(chatLog.getByText('Before midnight message')).toBeVisible({ timeout: 10_000 });

    // Wait for the shifted clock to cross midnight
    await sharedPage.waitForTimeout(7_000);

    // Send another message — its server-time will be shifted to ~2s after midnight (next day)
    bot.sendMessage('#date-sep', 'After midnight message');
    await expect(chatLog.getByText('After midnight message')).toBeVisible({ timeout: 10_000 });

    // A date separator should now appear between the two days
    await expect(chatLog.locator('[role="separator"]')).toBeVisible({ timeout: 10_000 });
  });

  test('separator shows formatted date text', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // The separator should contain a human-readable date
    const separator = chatLog.locator('[role="separator"]');
    const text = await separator.first().textContent();

    // date-fns 'PPP' format produces e.g. "March 18th, 2026" or locale equivalent
    // Just verify it contains non-empty date text
    expect(text).toBeTruthy();
    expect((text ?? '').trim().length).toBeGreaterThan(0);
  });
});
