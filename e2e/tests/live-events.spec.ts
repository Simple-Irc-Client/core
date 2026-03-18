import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('eventbot');
  await bot.join('#live-events');
  await bot.setTopic('#live-events', 'Live events test channel');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'live-tester', { channels: ['#live-events'] });
  await sharedPage.getByRole('button', { name: '#live-events' }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Live events', () => {
  test.describe.configure({ mode: 'serial' });

  test('user join shows message and updates user list', async () => {
    const chatLog = sharedPage.getByRole('log');
    const usersSidebar = sharedPage.getByRole('complementary', { name: 'Users' });

    // Create a new bot that joins the channel
    const joiner = await createIrcClient('joiner');
    await joiner.join('#live-events');

    // Join message should appear in chat log
    await expect(chatLog.getByText(/joiner has joined/)).toBeVisible({ timeout: 10_000 });

    // User should appear in the users sidebar
    await expect(usersSidebar.getByText('joiner')).toBeVisible({ timeout: 5_000 });

    joiner.disconnect();
  });

  test('user part shows message and removes from user list', async () => {
    const chatLog = sharedPage.getByRole('log');
    const usersSidebar = sharedPage.getByRole('complementary', { name: 'Users' });

    // Create a bot, join, then part
    const parter = await createIrcClient('parter');
    await parter.join('#live-events');
    await expect(usersSidebar.getByText('parter')).toBeVisible({ timeout: 10_000 });

    await parter.part('#live-events', 'goodbye');

    // Part message should appear
    await expect(chatLog.getByText(/parter has left/)).toBeVisible({ timeout: 10_000 });

    // User should be removed from sidebar
    await expect(usersSidebar.getByText('parter')).not.toBeVisible({ timeout: 5_000 });

    parter.disconnect();
  });

  test('user quit shows message in shared channels', async () => {
    const chatLog = sharedPage.getByRole('log');
    const usersSidebar = sharedPage.getByRole('complementary', { name: 'Users' });

    // Create a bot, join, then quit
    const quitter = await createIrcClient('quitter');
    await quitter.join('#live-events');
    await expect(usersSidebar.getByText('quitter')).toBeVisible({ timeout: 10_000 });

    quitter.disconnect();

    // Quit message should appear
    await expect(chatLog.getByText(/quitter has quit/)).toBeVisible({ timeout: 10_000 });

    // User should be removed from sidebar
    await expect(usersSidebar.getByText('quitter')).not.toBeVisible({ timeout: 5_000 });
  });

  test('nick change shows message and updates user list', async () => {
    const chatLog = sharedPage.getByRole('log');
    const usersSidebar = sharedPage.getByRole('complementary', { name: 'Users' });

    // Create a bot, join, then change nick
    const renamer = await createIrcClient('oldnick');
    await renamer.join('#live-events');
    await expect(usersSidebar.getByText('oldnick')).toBeVisible({ timeout: 10_000 });

    await renamer.changeNick('newnick');

    // Nick change message should appear
    await expect(chatLog.getByText(/oldnick has changed his nickname to newnick/)).toBeVisible({ timeout: 10_000 });

    // User list should show new nick, not old nick
    await expect(usersSidebar.getByText('newnick')).toBeVisible({ timeout: 5_000 });
    await expect(usersSidebar.getByText('oldnick')).not.toBeVisible();

    renamer.disconnect();
  });

  test('topic change updates topic input and shows message', async () => {
    const chatLog = sharedPage.getByRole('log');

    // Bot changes the topic
    await bot.setTopic('#live-events', 'New topic from bot');

    // Topic change message should appear in chat
    await expect(chatLog.getByText(/has changed the topic to/)).toBeVisible({ timeout: 10_000 });

    // Topic input should show new topic — rendered as read-only text or input
    await expect(sharedPage.getByText('New topic from bot')).toBeVisible({ timeout: 5_000 });

    // Restore original topic
    await bot.setTopic('#live-events', 'Live events test channel');
  });

  test('ACTION (/me) message is displayed', async () => {
    const chatLog = sharedPage.getByRole('log');

    // Bot sends a CTCP ACTION
    bot.sendAction('#live-events', 'waves hello');

    // Action message should be visible
    await expect(chatLog.getByText('waves hello')).toBeVisible({ timeout: 10_000 });
  });

  test('NOTICE message is displayed', async () => {
    const chatLog = sharedPage.getByRole('log');

    // Bot sends a NOTICE to the channel
    bot.sendNotice('#live-events', 'Important notice from bot');

    // Notice text should appear
    await expect(chatLog.getByText('Important notice from bot')).toBeVisible({ timeout: 10_000 });
  });
});
