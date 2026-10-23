import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let op: IrcClient;
let visitor: IrcClient;
let page: Page;
let nick: string;
let channel: string;

test.beforeAll(async ({ browser }, testInfo) => {
  skipWithoutIrcv3('channel events are replayed with draft/event-playback');
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  nick = `eventsuser-${tag}`;
  channel = `#events-${tag}`;

  op = await createIrcClient(`eventsop-${tag}`);
  await op.join(channel);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, nick, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  visitor?.disconnect();
  op?.disconnect();
});

test.describe('Channel events in chat history', () => {
  test('rejoining after a kick shows what happened as history, without acting on it again', async ({}, testInfo) => {
    const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
    const visitorNick = `eventsvisitor-${tag}`;
    const chatLog = page.getByTestId('chat-log');

    visitor = await createIrcClient(visitorNick);
    await visitor.join(channel);
    visitor.sendMessage(channel, 'visitor says hi');
    await visitor.part(channel, 'see you');

    op.kick(channel, nick, 'out you go');
    await expect(page.getByRole('button', { name: channel, exact: true })).toHaveCount(0, { timeout: 10_000 });

    await page.locator('#message-input').fill(`/join ${channel}`);
    await page.locator('#message-input').press('Enter');
    await expect(page.getByTestId('chat-header-name')).toContainText(channel, { timeout: 10_000 });

    // The events before the rejoin, from the server's history, with any collapsed run opened up
    await expect(chatLog.getByText('visitor says hi')).toBeVisible({ timeout: 10_000 });
    for (const run of await chatLog.locator('.sic-msg-events-toggle').all()) {
      await run.click();
    }
    await expect(chatLog.getByText(`${visitorNick} has joined`)).toHaveCount(1);
    await expect(chatLog.getByText(`${visitorNick} has left (see you)`)).toHaveCount(1);
    await expect(chatLog.getByText(`You have been kicked from ${channel} by eventsop-${tag} (out you go)`)).toHaveCount(1);
    // As events, not as the server's text stand-ins for clients without event playback
    await expect(chatLog.getByText(/joined the channel|left the channel/)).toHaveCount(0);

    // The replayed kick did not close the window again, nor did the replayed join bring the visitor back
    await expect(page.getByTestId('chat-header-name')).toContainText(channel);
    await expect(page.getByRole('button', { name: channel, exact: true })).toHaveCount(1);
    await expect(page.getByTestId('users-sidebar').getByRole('button', { name: visitorNick })).toHaveCount(0);
  });
});
