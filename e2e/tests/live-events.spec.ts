import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { chooseMembershipEventsDisplay, connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;
let channel: string;
/** Keeps the parallel browser projects, which share one IRC server, out of each other's channel */
let tag: string;

test.beforeAll(async ({ browser }, testInfo) => {
  tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#live-events-${tag}`;
  bot = await createIrcClient(`eventbot-${tag}`);
  await bot.join(channel);
  await bot.setTopic(channel, 'Live events test channel');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, `live-tester-${tag}`, { channels: [channel] });
  await sharedPage.getByRole('button', { name: channel, exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  // These tests are about each event's own line; collapsing them has its own spec
  await chooseMembershipEventsDisplay(sharedPage, 'Show all');
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Live events', () => {
  test.describe.configure({ mode: 'serial' });

  test('user join shows message and updates user list', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

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
    const chatLog = sharedPage.getByTestId('chat-log');
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

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
    const chatLog = sharedPage.getByTestId('chat-log');
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

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
    const chatLog = sharedPage.getByTestId('chat-log');
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

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
    const chatLog = sharedPage.getByTestId('chat-log');

    // Bot changes the topic
    await bot.setTopic(channel, 'New topic from bot');

    // Topic change message should appear in chat
    await expect(chatLog.getByText(`eventbot-${tag} has changed the topic to: New topic from bot`)).toBeVisible({ timeout: 10_000 });

    // Topic display should show new topic
    await expect(sharedPage.getByTestId('topic-display')).toHaveText('New topic from bot', { timeout: 5_000 });

    // Restore original topic
    await bot.setTopic(channel, 'Live events test channel');
  });

  test('ACTION (/me) message is displayed', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Bot sends a CTCP ACTION
    bot.sendAction(channel, 'waves hello');

    // Action message should be visible
    await expect(chatLog.getByText('waves hello')).toBeVisible({ timeout: 10_000 });
  });

  test('NOTICE message is displayed', async () => {
    const chatLog = sharedPage.getByTestId('chat-log');

    // Bot sends a NOTICE to the channel
    bot.sendNotice(channel, 'Important notice from bot');

    // Notice text should appear
    await expect(chatLog.getByText('Important notice from bot')).toBeVisible({ timeout: 10_000 });
  });
});
