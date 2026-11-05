import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let bot: IrcClient;

const END_OF_WHOIS = / 318 /;

/** The test servers send 671 or nothing, so each WHOIS reply gets the line DALnet sends in its place before it ends */
const sendDalnetSecureConnectionInWhois = (page: Page, nick: string): Promise<void> =>
  page.routeWebSocket(/.*/, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (typeof message === 'string' && END_OF_WHOIS.test(message)) {
        socket.send(`:lion.tx.us.dal.net 275 me ${nick} :is using a secure connection (SSL)`);
      }
      socket.send(message);
    });
  });

test.afterEach(() => {
  bot?.disconnect();
});

test('a WHOIS reply shows DALnet\'s secure connection line in the window it was asked from', async ({ page }, testInfo) => {
  const tag = testTag(testInfo);
  const channel = `#whois-ssl-${tag}`;
  bot = await createIrcClient(`sslbot-${tag}`);
  await bot.join(channel);
  await sendDalnetSecureConnectionInWhois(page, bot.nick);

  await page.goto('/');
  await connectViaWizard(page, `ssluser-${tag}`, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await page.locator('#message-input').fill(`/whois ${bot.nick}`);
  await page.locator('#message-input').press('Enter');

  await expect(page.getByTestId('chat-log').getByText(`* ${bot.nick} is using a Secure Connection`)).toBeVisible({ timeout: 10_000 });
});
