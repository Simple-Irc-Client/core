import { test, expect, type Page } from '@playwright/test';

import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, dropConnection, installWebSocketKillSwitch } from '../helpers';
import { CTCP, ctcpBody, E2eePeer } from '../e2ee-peer';

/**
 * E2EE across our own disconnect/reconnect.
 *
 * When the socket drops, sessions are torn down (the keys are per-connection),
 * but `endAllSessions` snapshots who we were actively encrypted with. Once we
 * reconnect and MONITOR reports that peer online again, `resumePendingEncryption`
 * silently re-sends an OFFER — the user shouldn't have to press "Encrypt again"
 * after every blip. A session the user *deliberately* turned off must not come
 * back that way.
 *
 * Named *-reconnect.spec.ts so playwright.config.ts routes it to the serial
 * reconnect project.
 */

const APP_NICK = 'e2ee-recon-tester';
const BOT_NICK = 'e2eereconbot';

let bot: IrcClient;
let page: Page;
let botNick: string;
let peer: E2eePeer;

const waitForCapturedLine = async (capture: { lines: string[] }, needle: string, timeout = 20_000): Promise<string> => {
  await expect
    .poll(() => capture.lines.some((line) => line.includes(needle)), { timeout, message: `no line containing ${needle}` })
    .toBe(true);
  return capture.lines.find((line) => line.includes(needle)) ?? '';
};

const openDmWithBot = async (): Promise<void> => {
  const sidebar = page.getByTestId('channels-sidebar');
  if (await sidebar.getByRole('button', { name: botNick }).isVisible().catch(() => false)) {
    await sidebar.getByRole('button', { name: botNick }).click();
    return;
  }
  bot.sendMessage(APP_NICK, 'opening a window');
  await expect(sidebar.getByRole('button', { name: botNick })).toBeVisible({ timeout: 20_000 });
  await sidebar.getByRole('button', { name: botNick }).click();
};

/** Bot offers, the app accepts — leaves the conversation encrypted on both sides. */
const handshakeWithBotAsInitiator = async (): Promise<void> => {
  // Inbound offers are throttled to one per peer per second; space re-handshakes out.
  await page.waitForTimeout(1100);

  await peer.newHandshake();
  const capture = bot.captureLines();
  bot.send(`PRIVMSG ${APP_NICK} :${CTCP}${peer.offerFrame()}${CTCP}`);

  await expect(page.getByTestId('e2ee-banner')).toContainText('wants to encrypt', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Encrypt', exact: true }).click();

  const acceptLine = await waitForCapturedLine(capture, 'SIC-E2EE ACCEPT');
  capture.stop();

  const match = /^SIC-E2EE ACCEPT 1 (\S+) (\S+)$/.exec(ctcpBody(acceptLine) ?? '');
  expect(match, 'the ACCEPT frame should be well formed').not.toBeNull();
  await peer.completeHandshake('initiator', match?.[1] ?? '', match?.[2] ?? '');

  await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /Encrypted/, { timeout: 10_000 });
};

const reconnectViaBanner = async (): Promise<void> => {
  await dropConnection(page);
  await expect(page.getByText('Not connected to server').first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Not connected to server').first()).not.toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
};

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient(BOT_NICK);
  botNick = bot.nick;

  peer = new E2eePeer();
  await peer.init();

  page = await browser.newPage();
  await installWebSocketKillSwitch(page);
  await page.goto('/');
  await connectViaWizard(page, APP_NICK, { channels: [] });
});

test.afterAll(async () => {
  await page.close();
  bot.disconnect();
});

test.describe('E2EE resume on reconnect', () => {
  test.describe.configure({ mode: 'serial' });

  test('re-offers encryption automatically after the connection drops and returns', async () => {
    await openDmWithBot();
    await handshakeWithBotAsInitiator();

    // Capture from before the drop so nothing the app sends on the way back is missed.
    const capture = bot.captureLines();

    await reconnectViaBanner();

    // No "Encrypt again" click — MONITOR sees the bot online, resume fires the OFFER.
    const offerLine = await waitForCapturedLine(capture, 'SIC-E2EE OFFER');
    expect(offerLine).toContain(`PRIVMSG ${botNick}`);
    expect(ctcpBody(offerLine), 'the re-OFFER must be a well-formed handshake frame')
      .toMatch(/^SIC-E2EE OFFER 1 \S+ \S+$/);

    // And the app is driving a real handshake: answering the OFFER re-establishes the lock.
    const match = /^SIC-E2EE OFFER 1 (\S+) (\S+)$/.exec(ctcpBody(offerLine) ?? '');
    await peer.newHandshake();
    await peer.completeHandshake('responder', match?.[1] ?? '', match?.[2] ?? '');
    bot.send(`NOTICE ${APP_NICK} :${CTCP}${peer.acceptFrame()}${CTCP}`);
    capture.stop();

    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /Encrypted/, { timeout: 15_000 });
  });

  test('does not re-offer a session the user turned off before the drop', async () => {
    await openDmWithBot();
    await handshakeWithBotAsInitiator();

    // User ends encryption on purpose.
    await page.getByTestId('e2ee-status-button').click();
    await page.getByTestId('e2ee-end-button').click();
    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /not encrypted|plaintext|before/i, { timeout: 10_000 });

    const capture = bot.captureLines();
    await reconnectViaBanner();

    // Give resume every chance to (wrongly) fire: reconnect + MONITOR round-trip.
    await page.waitForTimeout(8_000);
    capture.stop();

    expect(capture.lines.join('\n'), 'a deliberately ended session must not be silently resurrected')
      .not.toContain('SIC-E2EE OFFER');
  });

  test('a changed identity key on the resume handshake is blocked, not silently accepted', async () => {
    await openDmWithBot();
    await handshakeWithBotAsInitiator(); // pins the real peer identity

    const capture = bot.captureLines();
    await reconnectViaBanner();

    // Resume fires an OFFER on its own. Answer it as someone else holding this
    // nick with a *different* identity key — a reinstall, or an interception.
    const offerLine = await waitForCapturedLine(capture, 'SIC-E2EE OFFER');
    capture.stop();
    const match = /^SIC-E2EE OFFER 1 (\S+) (\S+)$/.exec(ctcpBody(offerLine) ?? '');

    const impostor = new E2eePeer();
    await impostor.init();
    await impostor.completeHandshake('responder', match?.[1] ?? '', match?.[2] ?? '');
    bot.send(`NOTICE ${APP_NICK} :${CTCP}${impostor.acceptFrame()}${CTCP}`);

    // The pin backstop fires: the user is told, and the session does NOT come up.
    await expect(page.getByTestId('e2ee-banner')).toContainText('encryption key has changed', { timeout: 20_000 });
    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /key changed/, { timeout: 10_000 });
    await expect(page.getByTestId('e2ee-status-button')).not.toHaveAttribute('aria-label', /Encrypted,/);

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByTestId('e2ee-banner')).toBeHidden();
  });
});
