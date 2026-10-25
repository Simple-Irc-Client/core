import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3, testServer } from '../test-server';

// More than the one page of history a joined channel starts with
const FILLER_LINES = 60;

let bot: IrcClient;
let page: Page;
let channel: string;

const msgidOf = (line: string): string => {
  const msgid = /(?:^@|;)msgid=([^; ]+)/.exec(line)?.[1];
  if (msgid === undefined) {
    throw new Error(`No msgid in ${line}`);
  }
  return msgid;
};

/** The bot says something and learns the msgid the server gave it, from its echo */
const botSays = async (target: string, text: string, tags = ''): Promise<string> => {
  const echo = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${target} :${text}`));
  bot.send(`${tags}PRIVMSG ${target} :${text}`);
  return msgidOf(await echo);
};

// By its own text: a reply's quote holds the text of the message it answers
const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

const replyTo = async (text: string): Promise<void> => {
  const row = messageRow(text);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.hover();
  await row.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(page.getByText(/^Replying to /)).toContainText(text);
};

const send = async (text: string): Promise<void> => {
  const input = page.locator('#message-input');
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press('Enter');
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  channel = `#replies-${tag}`;

  bot = await createIrcClient(`replybot-${tag}`, undefined, undefined, testServer().ircv3 ? ['message-tags', 'echo-message'] : undefined);
  await bot.join(channel);

  await page.goto('/');
  await connectViaWizard(page, `replyuser-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Replies', () => {
  test('a reply shows what it answers, and clicking that goes to it', async () => {
    skipWithoutIrcv3('replies refer to a msgid in a client tag');

    const msgid = await botSays(channel, 'what time is it?');
    await botSays(channel, 'noon', `@+draft/reply=${msgid} `);

    const quote = messageRow('noon').locator('.sic-msg-reply');
    await expect(quote).toContainText(bot.nick, { timeout: 10_000 });
    await expect(quote).toContainText('what time is it?');

    await quote.click();
    await expect(messageRow('what time is it?')).toHaveAttribute('data-shown');
  });

  test('replying to a message refers to it by its msgid', async () => {
    skipWithoutIrcv3('replies refer to a msgid in a client tag');

    const msgid = await botSays(channel, 'ask me anything');
    await replyTo('ask me anything');

    const received = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :anything it is`));
    await send('anything it is');

    expect((await received).split(' ')[0]).toContain(`+draft/reply=${msgid}`);
    await expect(page.getByText(/^Replying to /)).toHaveCount(0);
    await expect(messageRow('anything it is').locator('.sic-msg-reply')).toContainText('ask me anything', { timeout: 10_000 });
  });

  test('replying quotes the message where the server has no message tags', async () => {
    test.skip(testServer().ircv3, 'ngircd has no message-tags');

    bot.sendMessage(channel, 'old school question');
    await replyTo('old school question');

    const lines = bot.captureLines();
    const received = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :old school answer`));
    await send('old school answer');
    await received;
    lines.stop();

    expect(lines.lines.filter((line) => line.includes(`PRIVMSG ${channel} :`)).map((line) => line.slice(line.indexOf(' :', line.indexOf('PRIVMSG')) + 2))).toEqual([
      `> <${bot.nick}> old school question`,
      'old school answer',
    ]);
    await expect(messageRow(`<${bot.nick}> old school question`)).toHaveAttribute('data-quote');
  });

  test('Escape cancels a reply', async () => {
    bot.sendMessage(channel, 'never mind');
    await replyTo('never mind');

    await page.locator('#message-input').press('Escape');
    await expect(page.getByText(/^Replying to /)).toHaveCount(0);

    const lines = bot.captureLines();
    const received = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :just talking`));
    await send('just talking');
    const line = await received;
    lines.stop();

    expect(line).not.toContain('draft/reply');
    expect(lines.lines.filter((captured) => captured.includes('> <'))).toEqual([]);
  });

  test('clicking a reply to a message not loaded pages back through history to it', async () => {
    skipWithoutIrcv3('history is fetched with draft/chathistory');

    const longChannel = `${channel}-long`;
    await bot.join(longChannel);
    const msgid = await botSays(longChannel, 'the very first question');
    for (let number = 1; number <= FILLER_LINES; number++) {
      bot.sendMessage(longChannel, `filler ${number}`);
    }
    await botSays(longChannel, 'the late answer', `@+draft/reply=${msgid} `);

    await page.locator('#message-input').fill(`/join ${longChannel}`);
    await page.locator('#message-input').press('Enter');
    await expect(page.getByTestId('chat-header-name')).toContainText(longChannel, { timeout: 10_000 });

    const quote = messageRow('the late answer').locator('.sic-msg-reply');
    await expect(quote).toHaveText('Reply to an earlier message', { timeout: 10_000 });
    await expect(messageRow('the very first question')).toHaveCount(0);

    await quote.click();

    const original = messageRow('the very first question');
    await expect(original).toHaveAttribute('data-shown', { timeout: 10_000 });
    await expect(original).toBeInViewport();
    await expect(quote).toContainText('the very first question');
  });
});
