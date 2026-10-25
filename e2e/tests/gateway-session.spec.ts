import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch, projectTag } from '../helpers';
import { createIrcClient, type IrcClient } from '../irc-client';

/**
 * Resumable gateway sessions: when a phone backgrounds the tab its WebSocket dies, but the gateway keeps the IRC
 * connection, so the page comes back to the same session and sees what it missed, and nobody else sees a quit.
 */

// Both browser projects share one server, so names are per project (see e2e-nick-collision-flake)
const names = (testInfo: TestInfo, base: string): { nick: string; peer: string; channel: string } => {
  const tag = projectTag(testInfo);
  return { nick: `${base}-${tag}`, peer: `${base}-p-${tag}`, channel: `#${base}-${tag}` };
};

const joinChannel = async (page: Page, nick: string, channel: string): Promise<void> => {
  const input = page.locator('#message-input');
  await expect(input).toBeEnabled({ timeout: 10_000 });
  await input.fill(`/join ${channel}`);
  await input.press('Enter');
  const sidebarEntry = page.getByTestId('channels-sidebar').getByRole('button', { name: channel, exact: true });
  await expect(sidebarEntry).toBeVisible({ timeout: 10_000 });
  await sidebarEntry.click();
  await expect(page.getByTestId('chat-header-name')).toContainText(channel);
  // The sidebar entry appears before the server confirms the join
  await expect(page.getByTestId('chat-log').getByText(`${nick} has joined`)).toBeVisible({ timeout: 10_000 });
};

const sendFromApp = async (page: Page, text: string): Promise<void> => {
  const input = page.locator('#message-input');
  await input.fill(text);
  await input.press('Enter');
};

/** Matches a line `nick` sent with one of `commands` (a regex alternation such as 'QUIT|JOIN'). */
const sentBy = (nick: string, commands: string) => (line: string): boolean =>
  new RegExp(`^(@\\S+ )?:${nick}!\\S+ (${commands})\\b`, 'i').test(line);

test.describe('Resumable gateway session', () => {
  let peer: IrcClient | undefined;

  test.afterEach(() => {
    peer?.disconnect();
    peer = undefined;
  });

  test('a dropped connection resumes the same IRC session and shows what was missed', async ({ page }, testInfo) => {
    const { nick, peer: peerNick, channel } = names(testInfo, 'gw-resume');
    await installWebSocketKillSwitch(page);
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [] });
    await joinChannel(page, nick, channel);

    peer = await createIrcClient(peerNick);
    await peer.join(channel);
    const peerSaw = peer.captureLines();

    await dropConnection(page);
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });

    peer.sendMessage(channel, 'sent while the tab was in the background');
    // Lets the line reach the gateway before the page comes back
    await page.waitForTimeout(500);

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Session resumed').first()).toBeVisible({ timeout: 15_000 });
    await expect(chatLog.getByText('sent while the tab was in the background')).toBeVisible();
    await expect(page.getByTestId('chat-header-name')).toContainText(channel);

    const delivered = peer.waitForLine((line) => line.includes(`PRIVMSG ${channel} :back again`));
    await sendFromApp(page, 'back again');
    await delivered;
    expect(peerSaw.lines.filter(sentBy(nick, 'QUIT|JOIN'))).toEqual([]);
  });

  test('after a page reload the old session is replaced instead of left behind', async ({ page }, testInfo) => {
    const { nick, peer: peerNick, channel } = names(testInfo, 'gw-reload');
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [] });
    await joinChannel(page, nick, channel);

    peer = await createIrcClient(peerNick);
    await peer.join(channel);

    // Let the persisted windows flush (IndexedDB debounce) so the reload restores the channel
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 20_000 });

    const oldSessionQuit = peer.waitForLine(sentBy(nick, 'QUIT'));
    const rejoined = peer.waitForLine(sentBy(nick, 'JOIN'));
    await page.getByRole('button', { name: 'Connect' }).click();

    // The same nick comes back: the reloaded page ended its old session rather than colliding with it
    await oldSessionQuit;
    await rejoined;
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  });

  test('disconnecting from the menu ends the session instead of leaving it to the gateway', async ({ page }, testInfo) => {
    const { nick, peer: peerNick, channel } = names(testInfo, 'gw-quit');
    await page.goto('/');
    await connectViaWizard(page, nick, { channels: [] });
    await joinChannel(page, nick, channel);

    peer = await createIrcClient(peerNick);
    await peer.join(channel);
    const quit = peer.waitForLine(sentBy(nick, 'QUIT'));

    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Disconnect' }).click();

    await quit;
  });
});
