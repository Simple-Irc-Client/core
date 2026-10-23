import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';
import { skipWithoutIrcv3, testServer } from '../test-server';

let bot: IrcClient;
let page: Page;
let channel: string;

const messageRow = (text: string): Locator =>
  page.getByTestId('chat-log').locator('.sic-msg').filter({ has: page.locator('.sic-msg-body', { hasText: text }) });

/** The text as rendered, with the line breaks the reader sees */
const shownText = async (row: Locator): Promise<string> => row.locator('.sic-msg-body').evaluate((body) => (body as HTMLElement).innerText);

const textOf = (line: string): string => line.slice(line.indexOf(' :', line.indexOf('PRIVMSG')) + 2);

/** The bot sends `lines` as one draft/multiline batch, a `+` before a line joining it to the previous one */
const botSendsBatch = async (target: string, reference: string, lines: string[], tags = ''): Promise<void> => {
  // The server relays it under a reference of its own
  const echo = bot.waitForLine((line) => /(?:^|\s)BATCH -/.test(line));
  bot.send(`${tags}BATCH +${reference} draft/multiline ${target}`);
  for (const line of lines) {
    const concat = line.startsWith('+');
    bot.send(`@batch=${reference}${concat ? ';draft/multiline-concat' : ''} PRIVMSG ${target} :${concat ? line.slice(1) : line}`);
  }
  bot.send(`BATCH -${reference}`);
  await echo;
};

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#multiline-${tag}`;

  bot = await createIrcClient(`multibot-${tag}`, undefined, undefined, testServer().ircv3 ? ['message-tags', 'echo-message', 'batch', 'draft/multiline'] : undefined);
  await bot.join(channel);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, `multiuser-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  bot?.disconnect();
});

test.describe('Multiline messages', () => {
  test.describe.configure({ mode: 'serial' });

  test('Shift+Enter starts a new line, and Enter sends the lines', async () => {
    const input = page.locator('#message-input');
    const lines = bot.captureLines();
    const last = bot.waitForLine((line) => line.includes(`PRIVMSG ${channel} :third line`));

    await input.pressSequentially('first line');
    await input.press('Shift+Enter');
    await input.press('Shift+Enter');
    await input.pressSequentially('third line');
    await expect(input).toHaveValue('first line\n\nthird line');
    await input.press('Enter');
    await last;
    lines.stop();
    await expect(input).toHaveValue('');

    const privmsgs = lines.lines.filter((line) => line.includes(`PRIVMSG ${channel} :`));
    if (testServer().ircv3) {
      // ergo relays the batch to a client that has draft/multiline, as one message
      const reference = /BATCH \+(\S+) draft\/multiline/.exec(lines.lines.join('\n'))?.[1];
      expect(reference).toBeDefined();
      expect(privmsgs.map(textOf)).toEqual(['first line', '', 'third line']);
      expect(privmsgs.every((line) => line.includes(`batch=${reference ?? ''}`))).toBe(true);
      expect(await shownText(messageRow('first line'))).toBe('first line\n\nthird line');
    } else {
      expect(privmsgs.map(textOf)).toEqual(['first line', 'third line']);
      await expect(messageRow('first line')).toHaveCount(1);
      await expect(messageRow('third line')).toHaveCount(1);
    }
  });

  test('a line too long for one message is split, and arrives whole', async () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    const lines = bot.captureLines();
    const last = bot.waitForLine((line) => line.endsWith(' word79'));

    const input = page.locator('#message-input');
    await input.fill(text);
    await input.press('Enter');
    await last;
    lines.stop();

    const privmsgs = lines.lines.filter((line) => line.includes(`PRIVMSG ${channel} :`));
    expect(privmsgs.length).toBeGreaterThan(1);
    if (testServer().ircv3) {
      expect(privmsgs.map(textOf).join('')).toBe(text);
      expect(privmsgs.slice(1).every((line) => line.includes('draft/multiline-concat'))).toBe(true);
      expect(await shownText(messageRow('word0 '))).toBe(text);
    } else {
      // Separate messages: ngircd drops the space each one ends with
      expect(privmsgs.map(textOf).join(' ').split(/\s+/)).toEqual(text.split(' '));
    }
  });

  test('a batch from another client shows as one message, its continued line joined', async () => {
    skipWithoutIrcv3('ngircd has no draft/multiline');

    await botSendsBatch(channel, 'mlbot1', ['roses are red', 'violets are ', '+blue']);

    const row = messageRow('roses are red');
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    expect(await shownText(row)).toBe('roses are red\nviolets are blue');
  });

  test('a batch comes back from history as one message', async () => {
    skipWithoutIrcv3('history is fetched with draft/chathistory');

    const historyChannel = `${channel}-history`;
    await bot.join(historyChannel);
    await botSendsBatch(historyChannel, 'mlbot2', ['said before', 'you joined']);

    const input = page.locator('#message-input');
    await input.fill(`/join ${historyChannel}`);
    await input.press('Enter');
    await expect(page.getByTestId('chat-header-name')).toContainText(historyChannel, { timeout: 10_000 });

    const row = messageRow('said before');
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    expect(await shownText(row)).toBe('said before\nyou joined');
  });
});
