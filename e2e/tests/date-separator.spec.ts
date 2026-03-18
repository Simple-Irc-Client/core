import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('datebot');
  await bot.join('#date-sep');

  sharedPage = await browser.newPage();

  // Override Date so we can control message timestamps without affecting timers.
  // Only `new Date()` (no-arg) and `Date.now()` are intercepted;
  // `new Date(value)` passes through untouched.
  await sharedPage.addInitScript(`
    (function() {
      var OrigDate = Date;
      var origNow = Date.now.bind(Date);
      var offset = 0;
      Object.defineProperty(window, '__dateOffset', {
        get: function() { return offset; },
        set: function(v) { offset = v; }
      });
      Date.now = function() { return origNow() + offset; };
      var NewDate = function Date() {
        if (arguments.length === 0) {
          return new OrigDate(origNow() + offset);
        }
        return new (Function.prototype.bind.apply(OrigDate, [null].concat(Array.prototype.slice.call(arguments))))();
      };
      NewDate.now = Date.now;
      NewDate.parse = OrigDate.parse;
      NewDate.UTC = OrigDate.UTC;
      NewDate.prototype = OrigDate.prototype;
      globalThis.Date = NewDate;
    })();
  `);

  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'date-tester', { channels: ['#date-sep'] });
  await sharedPage.getByRole('button', { name: '#date-sep' }).click();
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

    const chatLog = sharedPage.getByRole('log');
    await expect(chatLog.getByText('Same day message 1')).toBeVisible({ timeout: 10_000 });
    await expect(chatLog.getByText('Same day message 2')).toBeVisible({ timeout: 10_000 });

    // No date separator should exist between same-day messages
    await expect(chatLog.locator('[role="separator"]')).not.toBeVisible();
  });

  test('separator appears between messages from different days', async () => {
    const chatLog = sharedPage.getByRole('log');

    // First message is already from "today" (previous test).
    // Shift the browser clock forward by 1 day so the next message
    // is timestamped as tomorrow.
    await sharedPage.evaluate(() => {
      (window as unknown as Record<string, number>).__dateOffset = 86_400_000;
    });

    // Send a message — kernel will call `new Date()` which now returns tomorrow
    bot.sendMessage('#date-sep', 'Next day message');
    await expect(chatLog.getByText('Next day message')).toBeVisible({ timeout: 10_000 });

    // A date separator should now appear between the two days
    await expect(chatLog.locator('[role="separator"]')).toBeVisible({ timeout: 10_000 });
  });

  test('separator shows formatted date text', async () => {
    const chatLog = sharedPage.getByRole('log');

    // The separator should contain a human-readable date
    const separator = chatLog.locator('[role="separator"]');
    const text = await separator.first().textContent();

    // date-fns 'PPP' format produces e.g. "March 18th, 2026" or locale equivalent
    // Just verify it contains non-empty date text
    expect(text).toBeTruthy();
    expect((text ?? '').trim().length).toBeGreaterThan(0);
  });
});
