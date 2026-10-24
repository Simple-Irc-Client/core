import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let page: Page;
let bot: IrcClient;
let guest: IrcClient;
let tag: string;
let channel: string;
let otherChannel: string;
let userNick: string;

const input = () => page.locator('#message-input');
const chatLog = () => page.getByTestId('chat-log');

const type = async (command: string): Promise<void> => {
  await input().fill(command);
  await input().press('Enter');
};

/** What `client` receives once `command` is typed in the app */
const receivedOn = async (client: IrcClient, command: string, predicate: (line: string) => boolean): Promise<string> => {
  const received = client.waitForLine(predicate);
  await type(command);
  return received;
};

test.beforeAll(async ({ browser }, testInfo) => {
  // Each browser project runs this at once on the same server: names of its own keep them apart
  tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#chancmds-${tag}`;
  otherChannel = `#chancmds-other-${tag}`;
  userNick = `chancmds-${tag}`;

  bot = await createIrcClient(`chancmdbot-${tag}`);
  guest = await createIrcClient(`chancmdguest-${tag}`);

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, userNick);

  // The user creates both channels, so they hold ops in them
  for (const name of [channel, otherChannel]) {
    await type(`/join ${name}`);
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible({ timeout: 10_000 });
  }
  await bot.join(channel);
  await bot.join(otherChannel);
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.getByTestId('users-sidebar').getByText(bot.nick)).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  bot?.disconnect();
  guest?.disconnect();
});

test.describe('Channel and general commands', () => {
  test.describe.configure({ mode: 'serial' });

  test('/op and /deop, /voice and /devoice change a member\'s mode', async () => {
    const mode = (sign: string) => (line: string) => line.includes(`MODE ${channel} ${sign} ${bot.nick}`);

    expect(await receivedOn(bot, `/op ${bot.nick}`, mode('+o'))).toBeTruthy();
    expect(await receivedOn(bot, `/deop ${bot.nick}`, mode('-o'))).toBeTruthy();
    expect(await receivedOn(bot, `/voice ${bot.nick}`, mode('+v'))).toBeTruthy();
    expect(await receivedOn(bot, `/devoice ${bot.nick}`, mode('-v'))).toBeTruthy();
  });

  test('/mode sets a channel mode', async () => {
    expect(await receivedOn(bot, `/mode ${channel} +m`, (line) => line.includes(`MODE ${channel} +m`))).toBeTruthy();
    expect(await receivedOn(bot, `/mode ${channel} -m`, (line) => line.includes(`MODE ${channel} -m`))).toBeTruthy();
  });

  test('/ban bans a mask', async () => {
    expect(await receivedOn(bot, '/ban *!*@banned.example', (line) => line.includes(`MODE ${channel} +b *!*@banned.example`))).toBeTruthy();
  });

  test('/invite invites someone to the channel', async () => {
    expect(await receivedOn(guest, `/invite ${guest.nick}`, (line) => line.includes(`INVITE ${guest.nick} ${channel}`))).toBeTruthy();
  });

  test('/notice sends a notice', async () => {
    expect(await receivedOn(bot, `/notice ${bot.nick} a quiet word`, (line) => line.includes(`NOTICE ${bot.nick} :a quiet word`))).toBeTruthy();
  });

  test('/amsg says the same in every open channel', async () => {
    const capture = bot.captureLines();
    await type('/amsg hello everywhere');

    await expect.poll(() => capture.lines.filter((line) => line.includes(':hello everywhere')).length).toBe(2);
    capture.stop();
    expect(capture.lines.some((line) => line.includes(`PRIVMSG ${channel} :hello everywhere`))).toBe(true);
    expect(capture.lines.some((line) => line.includes(`PRIVMSG ${otherChannel} :hello everywhere`))).toBe(true);
    await expect(input()).toBeEnabled();
  });

  test('/raw sends a line as typed, and says so', async () => {
    expect(await receivedOn(bot, `/raw PRIVMSG ${bot.nick} :straight to the wire`, (line) => line.includes(`PRIVMSG ${bot.nick} :straight to the wire`))).toBeTruthy();
    await expect(chatLog().getByText(`PRIVMSG ${bot.nick} :straight to the wire`)).toBeVisible();
  });

  test('/names lists who is in the channel', async () => {
    await type(`/names ${channel}`);

    await expect(chatLog().getByText(new RegExp(`${bot.nick}`)).last()).toBeVisible({ timeout: 10_000 });
  });

  test('/whowas tells about someone who left', async () => {
    const gone = await createIrcClient(`chancmdgone-${tag}`);
    gone.disconnect();
    await expect.poll(async () => {
      await type(`/whowas ${gone.nick}`);
      return chatLog().getByText(gone.nick).count();
    }, { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test('/help lists the commands', async () => {
    await type('/help');

    await expect(chatLog().getByText('/cycle, /hop [reason]')).toBeVisible();
    await expect(chatLog().getByText('/help', { exact: false }).last()).toBeVisible();
  });

  test('/kb bans and kicks someone', async () => {
    const kicked = bot.waitForLine((line) => line.includes(`KICK ${channel} ${bot.nick} :out you go`));
    const banned = bot.waitForLine((line) => line.includes(`MODE ${channel} +b ${bot.nick}`));

    await type(`/kb ${bot.nick} out you go`);

    await banned;
    await kicked;
    await expect(input()).toBeEnabled();
    await expect(page.getByTestId('users-sidebar').getByText(bot.nick)).toBeHidden({ timeout: 10_000 });
  });

  // Rejoining costs the user their ops, so the commands that need them come before
  test('/cycle leaves the channel and joins it again', async () => {
    // The bot was kicked out above
    await guest.join(channel);
    const parted = guest.waitForLine((line) => line.includes(`PART ${channel}`) && line.startsWith(`:${userNick}!`));
    const joined = guest.waitForLine((line) => line.includes(`JOIN`) && line.includes(channel) && line.startsWith(`:${userNick}!`));

    await type('/cycle');

    await parted;
    await joined;
    await expect(page.getByRole('button', { name: channel, exact: true })).toBeVisible();
    await expect(input()).toBeEnabled();
  });

  test('/quit leaves the network with the given message', async () => {
    const quit = guest.waitForLine((line) => line.startsWith(`:${userNick}!`) && line.includes('QUIT') && line.includes('see you later'));

    await type('/quit see you later');

    await quit;
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });
  });
});
