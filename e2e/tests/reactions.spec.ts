import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';
import { skipWithoutIrcv3, testServer } from '../test-server';

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
const botSays = async (text: string): Promise<string> => {
  const echo = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${channel} :${text}`));
  bot.sendMessage(channel, text);
  return msgidOf(await echo);
};

const messageRow = (text: string): Locator => page.getByTestId('chat-log').locator('.sic-msg', { hasText: text });

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  channel = `#reactions-${tag}`;

  bot = await createIrcClient(`reactbot-${tag}`, undefined, undefined, testServer().ircv3 ? ['message-tags', 'echo-message'] : undefined);
  await bot.join(channel);

  await page.goto('/');
  await connectViaWizard(page, `reactuser-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Reactions', () => {
  test('a server without message tags offers no reactions', async () => {
    test.skip(testServer().ircv3, 'ngircd has no message-tags');

    bot.sendMessage(channel, 'nothing to react to');
    const row = messageRow('nothing to react to');
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.hover();
    await expect(row.locator('.sic-msg-react')).toHaveCount(0);
  });

  test('a reaction from someone else shows under the message', async () => {
    skipWithoutIrcv3('reactions are client tags');

    const msgid = await botSays('react to me');
    await expect(messageRow('react to me')).toBeVisible({ timeout: 10_000 });

    bot.send(`@+draft/react=🎉;+draft/reply=${msgid} TAGMSG ${channel}`);

    const reaction = messageRow('react to me').getByRole('button', { name: `🎉 from ${bot.nick}` });
    await expect(reaction).toHaveText('🎉1', { timeout: 10_000 });
    await expect(reaction).toHaveAttribute('aria-pressed', 'false');

    bot.send(`@+draft/unreact=🎉;+draft/reply=${msgid} TAGMSG ${channel}`);
    await expect(reaction).toHaveCount(0, { timeout: 10_000 });
  });

  test('reacting from the picker sends the reaction and shows it as ours', async () => {
    skipWithoutIrcv3('reactions are client tags');

    const msgid = await botSays('pick a reaction');
    const row = messageRow('pick a reaction');
    await expect(row).toBeVisible({ timeout: 10_000 });

    const sent = bot.waitForLine((line) => line.includes(`TAGMSG ${channel}`) && line.includes('+draft/react='));
    await row.hover();
    await row.getByRole('button', { name: 'Add reaction' }).click();
    await page.getByLabel('Reactions').getByRole('button').first().click();

    const tags = (await sent).split(' ')[0] ?? '';
    expect(tags).toContain(`+draft/reply=${msgid}`);
    const emoji = /\+draft\/react=([^;]+)/.exec(tags)?.[1] ?? '';

    const reaction = row.locator('.sic-reaction');
    await expect(reaction).toHaveText(`${emoji}1`, { timeout: 10_000 });
    await expect(reaction).toHaveAttribute('aria-pressed', 'true');

    // Joining someone else's reaction by clicking it
    bot.send(`@+draft/react=👀;+draft/reply=${msgid} TAGMSG ${channel}`);
    const eyes = row.getByRole('button', { name: /^👀/ });
    await expect(eyes).toHaveText('👀1', { timeout: 10_000 });
    const joined = bot.waitForLine((line) => line.includes(`+draft/react=👀`) && line.includes(`TAGMSG ${channel}`));
    await eyes.click();
    await joined;
    await expect(eyes).toHaveText('👀2', { timeout: 10_000 });
    await expect(eyes).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking our reaction takes it back', async () => {
    skipWithoutIrcv3('reactions are client tags');

    const msgid = await botSays('take it back');
    const eyes = messageRow('take it back').getByRole('button', { name: /^👀/ });
    bot.send(`@+draft/react=👀;+draft/reply=${msgid} TAGMSG ${channel}`);
    await expect(eyes).toHaveText('👀1', { timeout: 10_000 });
    const joined = bot.waitForLine((line) => line.includes('+draft/react=👀') && line.includes(`TAGMSG ${channel}`));
    await eyes.click();
    await joined;
    await expect(eyes).toHaveText('👀2', { timeout: 10_000 });

    const takenBack = bot.waitForLine((line) => line.includes('+draft/unreact=👀') && line.includes(`TAGMSG ${channel}`));

    await eyes.click();
    await takenBack;

    await expect(eyes).toHaveText('👀1', { timeout: 10_000 });
    await expect(eyes).toHaveAttribute('aria-pressed', 'false');
  });

  test('reactions given before joining come with the channel history', async () => {
    skipWithoutIrcv3('reactions are client tags');

    const historyChannel = `${channel}-history`;
    await bot.join(historyChannel);
    const echo = bot.waitForLine((line) => line.endsWith(`PRIVMSG ${historyChannel} :reacted before you came`));
    bot.sendMessage(historyChannel, 'reacted before you came');
    const msgid = msgidOf(await echo);
    bot.send(`@+draft/react=🚀;+draft/reply=${msgid} TAGMSG ${historyChannel}`);
    bot.send(`@+draft/react=🙈;+draft/reply=${msgid} TAGMSG ${historyChannel}`);
    // Its echo comes after the others, so all three are stored by then
    const lastStored = bot.waitForLine((line) => line.includes('+draft/unreact=🙈'));
    bot.send(`@+draft/unreact=🙈;+draft/reply=${msgid} TAGMSG ${historyChannel}`);
    await lastStored;

    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/join ${historyChannel}`);
    await messageInput.press('Enter');
    await expect(page.getByTestId('chat-header-name')).toContainText(historyChannel, { timeout: 10_000 });

    const row = messageRow('reacted before you came');
    await expect(row.getByRole('button', { name: `🚀 from ${bot.nick}` })).toHaveText('🚀1', { timeout: 10_000 });
    await expect(row.locator('.sic-reaction')).toHaveCount(1);
  });
});
