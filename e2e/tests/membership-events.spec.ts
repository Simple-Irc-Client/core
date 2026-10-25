import { test, expect, type Locator, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { chooseMembershipEventsDisplay, connectViaWizard, projectTag } from '../helpers';

let talker: IrcClient;
let page: Page;
let channel: string;
let tag: string;
const visitors: IrcClient[] = [];

const chatLog = (): Locator => page.getByTestId('chat-log');
const eventRuns = (): Locator => chatLog().locator('.sic-msg[data-category="events"]');

/** A line from someone who stays, so each test's events start a run of their own */
const startRound = async (text: string): Promise<void> => {
  talker.sendMessage(channel, text);
  await expect(chatLog().getByText(text)).toBeVisible({ timeout: 10_000 });
};

const visitor = async (name: string): Promise<IrcClient> => {
  const client = await createIrcClient(`${name}-${tag}`);
  visitors.push(client);
  return client;
};

test.beforeAll(async ({ browser }, testInfo) => {
  tag = projectTag(testInfo);
  channel = `#members-${tag}`;

  talker = await createIrcClient(`talker-${tag}`);
  await talker.join(channel);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, `watcher-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.getByTestId('users-sidebar').getByText(`talker-${tag}`, { exact: true })).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  talker?.disconnect();
  for (const client of visitors) {
    client.disconnect();
  }
});

test.describe('Joins and parts', () => {
  test.describe.configure({ mode: 'serial' });

  test('events in a row show as one line that expands to the lines themselves', async () => {
    await startRound('round one');
    const first = await visitor('drifter');
    const second = await visitor('settler');
    await first.join(channel);
    await second.join(channel);
    await first.part(channel);

    const toggle = eventRuns().last().getByRole('button');
    await expect(toggle).toHaveText(`Joined: settler-${tag} · Joined and left: drifter-${tag}`, { timeout: 10_000 });
    await expect(chatLog().getByText(`drifter-${tag} has joined`)).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(chatLog().getByText(`drifter-${tag} has joined`)).toBeVisible();
    await expect(chatLog().getByText(`settler-${tag} has joined`)).toBeVisible();
    await expect(chatLog().getByText(`drifter-${tag} has left`)).toBeVisible();

    await toggle.click();
    await expect(chatLog().getByText(`drifter-${tag} has joined`)).toHaveCount(0);
  });

  test('"Show all" shows every line', async () => {
    await chooseMembershipEventsDisplay(page, 'Show all');

    await expect(eventRuns()).toHaveCount(0);
    await expect(chatLog().getByText(`settler-${tag} has joined`)).toBeVisible();
    await expect(chatLog().getByText(`drifter-${tag} has left`)).toBeVisible();
  });

  test('hiding idle people keeps the events of someone who spoke', async () => {
    await chooseMembershipEventsDisplay(page, 'Collapse and hide idle users');
    await startRound('round three');
    const idle = await visitor('idler');
    const chatty = await visitor('chatty');
    await idle.join(channel);
    await chatty.join(channel);
    chatty.sendMessage(channel, 'quick hello');
    await expect(chatLog().getByText('quick hello')).toBeVisible({ timeout: 10_000 });
    await chatty.part(channel);

    await expect(chatLog().getByText(`chatty-${tag} has left`)).toBeVisible({ timeout: 10_000 });
    await expect(chatLog().getByText(`chatty-${tag} has joined`)).toBeVisible();
    await expect(chatLog().getByText(`idler-${tag} has joined`)).toHaveCount(0);
    // The earlier visitors never spoke either
    await expect(chatLog().getByText(new RegExp(`(settler|drifter)-${tag}`))).toHaveCount(0);
  });
});
