import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

/**
 * DCC end-to-end coverage for the **web** build.
 *
 * A browser cannot open a raw TCP socket, so the web build never accepts a DCC
 * session: every offer is refused and explained in Status. That is what these
 * tests pin down — together with the checks that run *before* the platform is
 * even consulted, so a hostile offer is rejected identically on every target.
 * The socket-level behaviour (real chat, real transfers, TLS) is covered by
 * `network-rs/tests/dcc.rs`; the state machine by
 * `src/features/dcc/__tests__/manager.test.ts`.
 */

// One bot per group of at most four offers. The client rate-limits DCC offers
// to five per nick per minute — behaviour one of these tests asserts — so the
// others must not share a nick with it or with each other.
let botA: IrcClient;
let botB: IrcClient;
let floodBot: IrcClient;
let page: Page;

// 3467383817 === 206.172.20.9 — routable, so the private-address guard is not
// what rejects these. 3232235777 === 192.168.1.1, which it does reject.
const PUBLIC_IP_INT = '3467383817';
const PRIVATE_IP_INT = '3232235777';

/** DCC travels as a CTCP, i.e. wrapped in \x01 inside a PRIVMSG. */
const sendDcc = (from: IrcClient, target: string, params: string): void => {
  from.send(`PRIVMSG ${target} :\u0001DCC ${params}\u0001`);
};

const openStatus = async (): Promise<void> => {
  await page.getByRole('button', { name: 'Status', exact: true }).click();
};

test.beforeAll(async ({ browser }) => {
  botA = await createIrcClient('dccbot-a');
  botB = await createIrcClient('dccbot-b');
  floodBot = await createIrcClient('dccbot-f');
  await botA.join('#dcc-test');

  page = await browser.newPage();
  await page.goto('/');
  await connectViaWizard(page, 'dcc-tester', { channels: ['#dcc-test'] });
  await page.getByRole('button', { name: '#dcc-test', exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page.close();
  botA.disconnect();
  botB.disconnect();
  floodBot.disconnect();
});

test.describe('DCC', () => {
  test.describe.configure({ mode: 'serial' });

  test('a chat offer is declined with an explanation in the web build', async () => {
    await openStatus();
    sendDcc(botA, 'dcc-tester', `CHAT chat ${PUBLIC_IP_INT} 5000`);

    await expect(page.getByTestId('chat-log')).toContainText('only available in the desktop app', {
      timeout: 10_000,
    });
    // No consent dialog: there is nothing the user could consent to here.
    await expect(page.getByTestId('dcc-offer-dialog')).toBeHidden();
  });

  test('a send offer is declined the same way', async () => {
    await openStatus();
    sendDcc(botA, 'dcc-tester', `SEND holiday.jpg ${PUBLIC_IP_INT} 5001 2048`);

    await expect(page.getByTestId('chat-log')).toContainText('only available in the desktop app', {
      timeout: 10_000,
    });
  });

  test('a private-address offer is refused before the platform is consulted', async () => {
    await openStatus();
    sendDcc(botA, 'dcc-tester', `CHAT chat ${PRIVATE_IP_INT} 5002`);

    await expect(page.getByTestId('chat-log')).toContainText('private address', { timeout: 10_000 });
  });

  test('an offer with an unparseable address is refused', async () => {
    await openStatus();
    sendDcc(botA, 'dcc-tester', 'CHAT chat notanaddress 5003');

    await expect(page.getByTestId('chat-log')).toContainText('invalid address', { timeout: 10_000 });
  });

  test('a passive (port 0) offer is refused with its own reason', async () => {
    await openStatus();
    sendDcc(botB, 'dcc-tester', `SEND a.bin ${PUBLIC_IP_INT} 0 16`);

    await expect(page.getByTestId('chat-log')).toContainText('passive', { timeout: 10_000 });
  });

  test('an offer at a privileged port is refused', async () => {
    await openStatus();
    sendDcc(botB, 'dcc-tester', `CHAT chat ${PUBLIC_IP_INT} 22`);

    await expect(page.getByTestId('chat-log')).toContainText('invalid port', { timeout: 10_000 });
  });

  test('an unsupported DCC subcommand is refused rather than half-handled', async () => {
    await openStatus();
    sendDcc(botB, 'dcc-tester', `RESUME a.bin ${PUBLIC_IP_INT} 5004 10`);

    await expect(page.getByTestId('chat-log')).toContainText('unsupported DCC request type', {
      timeout: 10_000,
    });
  });

  test('a DCC offer addressed to a channel is ignored entirely', async () => {
    await page.getByRole('button', { name: '#dcc-test', exact: true }).click();
    const chatLog = page.getByTestId('chat-log');
    const before = (await chatLog.textContent()) ?? '';

    sendDcc(botB, '#dcc-test', `CHAT chat ${PUBLIC_IP_INT} 5005`);
    // Long enough for the client to mishandle it, if it were going to.
    await page.waitForTimeout(1500);

    expect(await chatLog.textContent()).toBe(before);
    await expect(page.getByTestId('dcc-offer-dialog')).toBeHidden();
  });

  test('a CTCP flood from one nick stops producing output', async () => {
    await openStatus();
    const chatLog = page.getByTestId('chat-log');

    for (let i = 0; i < 12; i += 1) {
      sendDcc(floodBot, 'dcc-tester', `CHAT chat ${PUBLIC_IP_INT} ${5100 + i}`);
    }
    await page.waitForTimeout(2000);
    const settled = (await chatLog.textContent()) ?? '';

    // The rate limiter caps how many offers are ever acted on, so the log must
    // not carry one line per offer.
    const mentions = settled.split('only available in the desktop app').length - 1;
    expect(mentions).toBeLessThan(12);
  });

  test('/dcc with no arguments explains the usage', async () => {
    await openStatus();
    const messageInput = page.locator('#message-input');
    await messageInput.fill('/dcc');
    await messageInput.press('Enter');

    await expect(page.getByTestId('chat-log')).toContainText('/dcc chat|schat|send|ssend|close', {
      timeout: 5_000,
    });
  });

  test('/dcc list reports no active sessions', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill('/dcc list');
    await messageInput.press('Enter');

    await expect(page.getByTestId('chat-log')).toContainText('No active DCC sessions', {
      timeout: 5_000,
    });
  });

  test('/dcc chat from the web build says the desktop app is needed', async () => {
    const messageInput = page.locator('#message-input');
    await messageInput.fill('/dcc chat dccbot-a');
    await messageInput.press('Enter');

    await expect(page.getByTestId('chat-log')).toContainText('only available in the desktop app', {
      timeout: 5_000,
    });
  });

  test('/dcc is offered by command autocomplete', async () => {
    const messageInput = page.locator('#message-input');
    // pressSequentially, not fill: the autocomplete buffer is built from real
    // key events.
    await messageInput.pressSequentially('/dc');
    await messageInput.press('Tab');

    await expect(messageInput).toHaveValue('/dcc ');
  });
});
