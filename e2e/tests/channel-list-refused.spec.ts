import { test, expect, type Page } from '@playwright/test';
import { reachWizardChannelStep, testTag } from '../helpers';

const RATE_LIMITED = 'This command could not be completed because it has been used recently, and is rate-limited.';
const RATE_LIMITED_TRANSLATED = 'This command was used too recently and is rate-limited. Try again in a moment';

/** The test servers never rate-limit LIST, so the page's LIST is answered with the 263 Libera.Chat sends instead */
const rateLimitChannelList = (page: Page, nick: string): Promise<void> =>
  page.routeWebSocket(/.*/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      if (typeof message === 'string' && /^LIST$/i.test(message.trim())) {
        socket.send(`:irc.test 263 ${nick} LIST :${RATE_LIMITED}`);
        return;
      }
      server.send(message);
    });
  });

test.describe('Channel list refused by the server', () => {
  test('the wizard shows why there is no channel list instead of loading forever', async ({ page }, testInfo) => {
    const nick = `listlimit-${testTag(testInfo)}`;
    await rateLimitChannelList(page, nick);
    await page.goto('/');

    await reachWizardChannelStep(page, nick);

    await expect(page.getByText(RATE_LIMITED_TRANSLATED)).toBeVisible();
    await expect(page.getByText('Downloading channels list')).toBeHidden();
  });
});
