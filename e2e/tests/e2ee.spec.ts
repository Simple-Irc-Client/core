import { test, expect, type Page } from '@playwright/test';

import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag, waitForPersistedChannels } from '../helpers';
import { CTCP, ctcpBody, E2eePeer, FrameCollector } from '../e2ee-peer';

/**
 * End-to-end encryption, driven against a real ergo IRCd with a second real
 * participant.
 *
 * The bot implements SIC-E2EE independently (see `e2ee-peer.ts`), so these tests
 * check interoperability and — more importantly — what actually goes over the
 * wire. A UI that says "encrypted" while leaking plaintext would pass any test
 * that only looked at the screen.
 *
 * Everything is asserted from a capture started *before* the action that
 * triggers it. Registering a listener afterwards races the network: frames are
 * sent within a millisecond of the keypress and routinely arrive first.
 */

let bot: IrcClient;
let page: Page;
let appNick: string;
let botNick: string;

/** The bot's identity: each test's app pins it at the first handshake, and the impostor case gets one of its own */
let peer: E2eePeer;

/** Past the app's limit of one inbound offer per peer per second */
const OFFER_THROTTLE_MS = 1100;

/**
 * A test that re-handshakes sends several offers inside a second, far faster than any real client. Moving the
 * page's clock on is the right fix; loosening the throttle so the tests pass would let the tests set a security parameter.
 */
const passOfferThrottle = (): Promise<void> => page.clock.fastForward(OFFER_THROTTLE_MS);

const openDmWithBot = async (): Promise<void> => {
  const sidebar = page.getByTestId('channels-sidebar');
  if (await sidebar.getByRole('button', { name: botNick }).isVisible().catch(() => false)) {
    await sidebar.getByRole('button', { name: botNick }).click();
    return;
  }
  bot.sendMessage(appNick, 'opening a window');
  await expect(sidebar.getByRole('button', { name: botNick })).toBeVisible({ timeout: 20_000 });
  await sidebar.getByRole('button', { name: botNick }).click();
};

/**
 * Reassemble the first complete `SICE` message from a running capture.
 *
 * Rebuilt from scratch on each poll so it stays idempotent and needs no
 * listener that could miss an early frame.
 */
const waitForCipherPayload = async (capture: { lines: string[] }): Promise<string> => {
  let payload: string | null = null;

  await expect
    .poll(
      () => {
        const collector = new FrameCollector();
        payload = null;
        for (const line of capture.lines) {
          const body = ctcpBody(line);
          if (body !== null) {
            payload = collector.accept(body) ?? payload;
          }
        }
        return payload !== null;
      },
      { timeout: 20_000, message: 'no complete SICE frame arrived' },
    )
    .toBe(true);

  return payload ?? '';
};

const waitForCapturedLine = async (capture: { lines: string[] }, needle: string): Promise<string> => {
  await expect
    .poll(() => capture.lines.some((line) => line.includes(needle)), { timeout: 20_000, message: `no line containing ${needle}` })
    .toBe(true);

  return capture.lines.find((line) => line.includes(needle)) ?? '';
};

/** Drive the handshake with the bot as initiator; leaves both sides active. */
const handshakeAsInitiator = async (): Promise<void> => {
  await passOfferThrottle();

  await peer.newHandshake();
  const capture = bot.captureLines();

  bot.send(`PRIVMSG ${appNick} :${CTCP}${peer.offerFrame()}${CTCP}`);

  await expect(page.getByTestId('e2ee-banner')).toContainText('wants to encrypt', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Encrypt', exact: true }).click();

  const acceptLine = await waitForCapturedLine(capture, 'SIC-E2EE ACCEPT');
  capture.stop();

  const match = /^SIC-E2EE ACCEPT 1 (\S+) (\S+)$/.exec(ctcpBody(acceptLine) ?? '');
  expect(match, 'the ACCEPT frame should be well formed').not.toBeNull();

  await peer.completeHandshake('initiator', match?.[1] ?? '', match?.[2] ?? '');

  await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /Encrypted/, { timeout: 10_000 });
};

const sendInDm = async (text: string): Promise<void> => {
  const input = page.locator('#message-input');
  await expect(input).toBeEnabled();
  await input.fill(text);
  await input.press('Enter');
};

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  appNick = `e2ee-tester-${tag}`;

  bot = await createIrcClient(`e2eebot-${tag}`);
  botNick = bot.nick;

  peer = new E2eePeer();
  await peer.init();

  await page.clock.install();
  await page.goto('/');
  await connectViaWizard(page, appNick);
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('End-to-end encryption', () => {
  test('encrypts an outgoing message so no plaintext reaches the network', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /Encrypted, unverified/);

    const capture = bot.captureLines();
    const secret = 'the-eagle-lands-at-midnight';

    await sendInDm(secret);

    const payload = await waitForCipherPayload(capture);
    capture.stop();

    // The plaintext must appear nowhere in anything the server relayed.
    expect(capture.lines.join('\n')).not.toContain(secret);

    // And the ciphertext must decrypt back to exactly what was typed.
    expect(await peer.open(payload)).toEqual({ kind: 'm', text: secret });

    await expect(page.getByTestId('chat-log').getByText(secret)).toBeVisible();
  });

  test('decrypts an incoming message and shows it in the conversation', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    for (const frame of await peer.sealFrames('meet me by the river')) {
      bot.send(`PRIVMSG ${appNick} :${CTCP}${frame}${CTCP}`);
    }

    await expect(page.getByTestId('chat-log').getByText('meet me by the river')).toBeVisible({ timeout: 20_000 });
  });

  test('encrypts a long message that has to be split across frames', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    const long = `chunked-${'x'.repeat(900)}-end`;
    const capture = bot.captureLines();

    await sendInDm(long);

    const payload = await waitForCipherPayload(capture);
    const frameCount = capture.lines.filter((line) => (ctcpBody(line) ?? '').startsWith('SICE ')).length;
    capture.stop();

    expect(frameCount, 'a 900-character message must not fit in one IRC line').toBeGreaterThan(1);
    expect(await peer.open(payload)).toEqual({ kind: 'm', text: long });
  });

  test('keeps /me encrypted rather than sending a plaintext action', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    const capture = bot.captureLines();

    await sendInDm('/me waves-in-secret');

    const payload = await waitForCipherPayload(capture);
    capture.stop();

    expect(capture.lines.join('\n')).not.toContain('waves-in-secret');
    expect(await peer.open(payload)).toEqual({ kind: 'a', text: 'waves-in-secret' });
  });

  test('stops sending typing notifications while encrypted', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    const capture = bot.captureLines();
    await page.locator('#message-input').fill('composing something');
    // Typing notifications go out as the text changes, so ahead of the message itself
    await page.locator('#message-input').press('Enter');
    await waitForCipherPayload(capture);
    capture.stop();

    expect(capture.lines.join('\n')).not.toContain('TAGMSG');
  });

  test('declining leaves the conversation in plaintext', async () => {
    await openDmWithBot();

    const capture = bot.captureLines();
    bot.send(`PRIVMSG ${appNick} :${CTCP}${peer.offerFrame()}${CTCP}`);

    await expect(page.getByTestId('e2ee-banner')).toContainText('wants to encrypt', { timeout: 20_000 });
    await page.getByRole('button', { name: 'No thanks' }).click();

    await waitForCapturedLine(capture, 'SIC-E2EE DECLINE');
    await expect(page.getByTestId('e2ee-banner')).toBeHidden();

    // A message typed now goes out in the clear, as the user chose.
    await sendInDm('still-plaintext');

    const line = await waitForCapturedLine(capture, 'still-plaintext');
    capture.stop();

    expect(line).not.toContain('SICE ');
  });

  test('handshake notices render detached, not attributed to whoever spoke last', async () => {
    await openDmWithBot();

    // Something from a real speaker lands in the window first...
    bot.sendNotice(appNick, 'plain-notice-before-offer');
    await expect(page.getByTestId('chat-log').getByText('plain-notice-before-offer')).toBeVisible({ timeout: 20_000 });

    // ...then an inbound E2EE offer lands right under it. Without the detach it
    // groups under the previous author's header and reads as their message.
    bot.send(`PRIVMSG ${appNick} :${CTCP}${peer.offerFrame()}${CTCP}`);

    const offerRow = page
      .getByTestId('chat-log')
      .locator('.sic-msg', { hasText: 'wants to start an encrypted conversation' });
    await expect(offerRow).toBeVisible({ timeout: 20_000 });

    // It is a standalone system notice: flagged detached, not "content", and
    // carrying no nick of its own — so it cannot read as the bot's words.
    await expect(offerRow).toHaveAttribute('data-system', 'true');
    await expect(offerRow).not.toHaveAttribute('data-content');
    await expect(offerRow.locator('.sic-msg-nick')).toHaveCount(0);

    await page.getByRole('button', { name: 'No thanks' }).click();
    await expect(page.getByTestId('e2ee-banner')).toBeHidden();
  });

  test('a client that does not answer leaves the user informed, not stuck', async () => {
    // The app waits OFFER_TIMEOUT_MS (session.ts) before giving up on a
    // reply — 60s, deliberately generous so a slow link or a human taking a
    // moment to respond doesn't false-positive as "not a SIC client". That's
    // longer than Playwright's own default per-test timeout, so this test
    // needs its own room to actually wait it out.
    test.setTimeout(90_000);

    await openDmWithBot();

    const capture = bot.captureLines();

    // The bot deliberately ignores the offer, exactly as any non-SIC client does.
    await page.getByTestId('e2ee-status-button').click();
    await page.getByTestId('e2ee-start-button').click();
    // The popover stays open over the banner and would swallow the click below,
    // and closing it leaves focus on the lock button, which opens its tooltip
    // in the same spot. Move focus away so neither overlays the banner.
    await page.keyboard.press('Escape');
    await page.locator('#message-input').click();

    const offerLine = await waitForCapturedLine(capture, 'SIC-E2EE OFFER');
    capture.stop();

    // A well-formed CTCP is what makes other clients drop it silently.
    expect(ctcpBody(offerLine)).toMatch(/^SIC-E2EE OFFER 1 \S+ \S+$/);

    await expect(page.getByTestId('e2ee-banner')).toContainText('did not respond', { timeout: 70_000 });
    await page.getByRole('button', { name: 'Dismiss' }).click();
  });

  test('blocks a peer whose identity key changed instead of quietly re-keying', async () => {
    await openDmWithBot();
    // The genuine peer's key, pinned
    await handshakeAsInitiator();
    bot.send(`NOTICE ${appNick} :${CTCP}SIC-E2EE RESET${CTCP}`);
    await expect(page.getByTestId('e2ee-banner')).toContainText('you have encrypted with', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Dismiss' }).click();

    // Someone else now answers to this nick, holding a different identity key —
    // a reinstall, or an interception attempt. Either way the user must be told,
    // and the session must not come up.
    const impostor = new E2eePeer();
    await impostor.init();

    await passOfferThrottle();
    bot.send(`PRIVMSG ${appNick} :${CTCP}${impostor.offerFrame()}${CTCP}`);

    await expect(page.getByTestId('e2ee-banner')).toContainText('encryption key has changed', { timeout: 20_000 });
    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /key changed/);

    // No accept button is offered for a changed key.
    await expect(page.getByRole('button', { name: 'Encrypt', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByTestId('e2ee-banner')).toBeHidden();

    // The original pin survives, so the genuine peer still works afterwards.
    await handshakeAsInitiator();
    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /Encrypted, unverified/);
  });

  test('warns that a conversation is in the clear after an injected RESET', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    // Tearing the session down with a RESET is how an attacker forces the
    // conversation back to plaintext. Doing it silently is the actual risk.
    bot.send(`PRIVMSG ${appNick} :${CTCP}SIC-E2EE RESET${CTCP}`);

    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', /Encrypted/, { timeout: 5_000 });

    // A RESET is only honoured over NOTICE, so the PRIVMSG above must be ignored.
    bot.send(`NOTICE ${appNick} :${CTCP}SIC-E2EE RESET${CTCP}`);

    await expect(page.getByTestId('e2ee-banner')).toContainText('you have encrypted with', { timeout: 20_000 });
    await expect(page.getByTestId('e2ee-status-button')).toHaveAttribute(
      'aria-label',
      /encrypted with this person before/,
    );

    // Dismissing is a decision, so it must actually stick.
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByTestId('e2ee-banner')).toBeHidden();

    // ...and re-encrypting must arm the warning again for a later loss.
    await handshakeAsInitiator();
    bot.send(`NOTICE ${appNick} :${CTCP}SIC-E2EE RESET${CTCP}`);
    await expect(page.getByTestId('e2ee-banner')).toContainText('you have encrypted with', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Dismiss' }).click();
  });

  test('encrypted history is not written to disk', async () => {
    await openDmWithBot();
    await handshakeAsInitiator();

    await sendInDm('secret-that-must-not-persist');
    await expect(page.getByTestId('chat-log').getByText('secret-that-must-not-persist')).toBeVisible();

    bot.sendMessage(appNick, 'plaintext-that-should-persist');
    await expect(page.getByTestId('chat-log').getByText('plaintext-that-should-persist')).toBeVisible({ timeout: 20_000 });

    await waitForPersistedChannels(page, 'plaintext-that-should-persist');
    await page.reload();

    await openDmWithBot();
    const chatLog = page.getByTestId('chat-log');

    await expect(chatLog.getByText('plaintext-that-should-persist')).toBeVisible({ timeout: 20_000 });
    await expect(chatLog.getByText('secret-that-must-not-persist')).toHaveCount(0);
  });
});
