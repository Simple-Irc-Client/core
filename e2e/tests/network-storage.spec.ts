import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard, readIdbKey, readPersistedNetwork, testTag, waitForPersistedChannels, writeIdbKey } from '../helpers';

/**
 * Each network's data is kept under the network. An older version kept one
 * network's session in its settings and its windows per server of it; an
 * upgrade has to find them there.
 */

let page: Page;
let nick: string;
let channel: string;

const legacyWindows = (name: string, text: string) => ({
  state: {
    openChannels: [{
      name,
      category: 'channel',
      messages: [{ id: `legacy-${name}`, message: text, target: name, time: new Date().toISOString(), category: 'info' }],
      topic: '',
      topicSetBy: '',
      topicSetTime: 0,
      unReadMessages: 0,
      typing: [],
    }],
    openChannelsShortList: [{ name, category: 'channel', unReadMessages: 0 }],
  },
  version: 3,
});

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  nick = `storage-${tag}`;
  channel = `#legacy-${tag}`;

  await page.goto('/');
  await connectViaWizard(page, nick);
});

test.describe('Network storage', () => {
  test('an upgrade picks up the network and windows an older version saved', async () => {
    const network = await readPersistedNetwork(page);
    if (network === undefined) {
      throw new Error('no network in sic-networks - the wizard did not complete');
    }
    const { server } = network.session;
    const legacyKey = `sic-channels:${server.network}:${server.servers[server.default]}`;

    // A page of the app's origin without the app, so nothing writes over what is seeded
    await page.goto('/favicon.ico');
    await page.evaluate(({ server, nick, channel }) => {
      localStorage.removeItem('sic-networks');
      localStorage.setItem('sic-settings', JSON.stringify({
        state: { server, nick, isWizardCompleted: true, currentChannelName: channel, currentChannelCategory: 'channel' },
        version: 4,
      }));
    }, { server, nick, channel });
    await writeIdbKey(page, `sic-channels:${network.networkId}`, undefined);
    await writeIdbKey(page, legacyKey, JSON.stringify(legacyWindows(channel, 'kept by the older version')));
    await page.goto('/');

    await expect(page.getByTestId('channels-sidebar').getByRole('button', { name: channel, exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('kept by the older version')).toBeVisible();

    // Saved under the network from now on, with the older key gone
    await waitForPersistedChannels(page, 'kept by the older version');
    expect(await readIdbKey(page, legacyKey)).toBe('');
  });
});
