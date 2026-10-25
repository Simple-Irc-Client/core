import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { chooseMembershipEventsDisplay, connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let channel: string;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);
  channel = `#live-events-${tag}`;
  bot = await createIrcClient(`eventbot-${tag}`);
  await bot.join(channel);
  await bot.setTopic(channel, 'Live events test channel');

  await page.goto('/');
  await connectViaWizard(page, `live-tester-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  // These tests are about each event's own line; collapsing them has its own spec
  await chooseMembershipEventsDisplay(page, 'Show all');
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Live events', () => {
  test('user join shows message and updates user list', async () => {
    const chatLog = page.getByTestId('chat-log');
    const usersSidebar = page.getByTestId('users-sidebar');

    // Create a new bot that joins the channel
    const joiner = await createIrcClient(`joiner-${tag}`);
    await joiner.join(channel);

    // Join message should appear in chat log
    await expect(chatLog.getByText(`joiner-${tag} has joined`)).toBeVisible({ timeout: 10_000 });

    // User should appear in the users sidebar
    await expect(usersSidebar.getByText(`joiner-${tag}`, { exact: true })).toBeVisible({ timeout: 5_000 });

    joiner.disconnect();
  });

  test('user part shows message and removes from user list', async () => {
    const chatLog = page.getByTestId('chat-log');
    const usersSidebar = page.getByTestId('users-sidebar');

    // Create a bot, join, then part
    const parter = await createIrcClient(`parter-${tag}`);
    await parter.join(channel);
    await expect(usersSidebar.getByText(`parter-${tag}`, { exact: true })).toBeVisible({ timeout: 10_000 });

    await parter.part(channel, 'goodbye');

    // Part message should appear
    await expect(chatLog.getByText(new RegExp(`parter-${tag} has left`))).toBeVisible({ timeout: 10_000 });

    // User should be removed from sidebar
    await expect(usersSidebar.getByText(`parter-${tag}`, { exact: true })).not.toBeVisible({ timeout: 5_000 });

    parter.disconnect();
  });

  test('user quit shows message in shared channels', async () => {
    const chatLog = page.getByTestId('chat-log');
    const usersSidebar = page.getByTestId('users-sidebar');

    // Create a bot, join, then quit
    const quitter = await createIrcClient(`quitter-${tag}`);
    await quitter.join(channel);
    await expect(usersSidebar.getByText(`quitter-${tag}`, { exact: true })).toBeVisible({ timeout: 10_000 });

    quitter.disconnect();

    // Quit message should appear
    await expect(chatLog.getByText(new RegExp(`quitter-${tag} has quit`))).toBeVisible({ timeout: 10_000 });

    // User should be removed from sidebar
    await expect(usersSidebar.getByText(`quitter-${tag}`, { exact: true })).not.toBeVisible({ timeout: 5_000 });
  });

  test('nick change shows message and updates user list', async () => {
    const chatLog = page.getByTestId('chat-log');
    const usersSidebar = page.getByTestId('users-sidebar');

    // Create a bot, join, then change nick
    const renamer = await createIrcClient(`oldnick-${tag}`);
    await renamer.join(channel);
    await expect(usersSidebar.getByText(`oldnick-${tag}`, { exact: true })).toBeVisible({ timeout: 10_000 });

    await renamer.changeNick(`newnick-${tag}`);

    // Nick change message should appear
    await expect(chatLog.getByText(`oldnick-${tag} has changed his nickname to newnick-${tag}`)).toBeVisible({ timeout: 10_000 });

    // User list should show new nick, not old nick
    await expect(usersSidebar.getByText(`newnick-${tag}`, { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(usersSidebar.getByText(`oldnick-${tag}`, { exact: true })).not.toBeVisible();

    renamer.disconnect();
  });

  test('topic change updates topic input and shows message', async () => {
    const chatLog = page.getByTestId('chat-log');

    // Bot changes the topic
    await bot.setTopic(channel, 'New topic from bot');

    // Topic change message should appear in chat
    await expect(chatLog.getByText(`eventbot-${tag} has changed the topic to: New topic from bot`)).toBeVisible({ timeout: 10_000 });

    // Topic display should show new topic
    await expect(page.getByTestId('topic-display')).toHaveText('New topic from bot', { timeout: 5_000 });
  });

  test('ACTION (/me) message is displayed', async () => {
    const chatLog = page.getByTestId('chat-log');

    // Bot sends a CTCP ACTION
    bot.sendAction(channel, 'waves hello');

    // Action message should be visible
    await expect(chatLog.getByText('waves hello')).toBeVisible({ timeout: 10_000 });
  });

  test('NOTICE message is displayed', async () => {
    const chatLog = page.getByTestId('chat-log');

    // Bot sends a NOTICE to the channel
    bot.sendNotice(channel, 'Important notice from bot');

    // Notice text should appear
    await expect(chatLog.getByText('Important notice from bot')).toBeVisible({ timeout: 10_000 });
  });
});
