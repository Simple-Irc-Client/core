import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard, testTag } from '../helpers';

/** The lines the page sends to the IRC server; servers may rewrite the username (ergo makes every one `u`), so it is read here */
const recordSentLines = async (page: Page): Promise<string[]> => {
  const sent: string[] = [];
  await page.routeWebSocket(/.*/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      if (typeof message === 'string') {
        sent.push(message);
      }
      server.send(message);
    });
  });
  return sent;
};

test('a nick with characters a username can\'t have registers with them left out of the username', async ({ page }, testInfo) => {
  const tag = testTag(testInfo);
  const nick = `josh|${tag}`;
  const sent = await recordSentLines(page);

  await page.goto('/');
  await connectViaWizard(page, nick);

  expect(sent).toContain(`USER josh${tag} 0 * :${nick}`);
});
