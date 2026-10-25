import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, expectImageLoaded, openProfileSettings, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  skipWithoutIrcv3('avatars and colors are METADATA');
  bot = await createIrcClient(`metabot-${tag}`, '127.0.0.1', 6667, ['draft/metadata-2']);
  await bot.join(`#metadata-test-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `meta-tester-${tag}`, { channels: [`#metadata-test-${tag}`] });
  await page.getByRole('button', { name: `#metadata-test-${tag}`, exact: true }).click();
});

test.afterEach(() => {
  bot?.disconnect();
});

test.describe('Metadata', () => {
  test('set avatar via profile settings', async () => {
    const avatarUrl = 'https://simpleircclient.com/assets/test-image.png';

    // Open profile settings
    await openProfileSettings(page, 'profile');

    // Avatar input is conditionally rendered when the server supports metadata
    const avatarInput = page.locator('#avatar');
    await expect(avatarInput).toBeVisible({ timeout: 10_000 });
    await avatarInput.fill(avatarUrl);
    await avatarInput.press('Enter');

    // Close dialog
    await page.keyboard.press('Escape');

    // Avatar should display in the users sidebar and actually load (not swap to fallback)
    const usersSidebar = page.getByTestId('users-sidebar');
    await expectImageLoaded(usersSidebar.locator(`img[src="${avatarUrl}"]`));
  });

  test('set nick color via profile settings', async () => {

    // Open profile settings
    await openProfileSettings(page, 'profile');

    // Color input is conditionally rendered when the server supports metadata
    const colorInput = page.locator('#color');
    await expect(colorInput).toBeVisible({ timeout: 10_000 });
    await colorInput.fill('#ff0000');
    await colorInput.press('Enter');

    await page.keyboard.press('Escape');

    // Verify color is applied — nick in users sidebar should have the color style
    const usersSidebar = page.getByTestId('users-sidebar');
    const nickEl = usersSidebar.getByText(`meta-tester-${tag}`);
    await expect(nickEl).toBeVisible({ timeout: 10_000 });
    // The nick should have the chosen color applied
    await expect(nickEl).toHaveCSS('color', 'rgb(255, 0, 0)');
  });

  test('set display name, status and homepage via profile settings', async () => {
    const nick = `meta-tester-${tag}`;

    // Each change closes the dialog
    for (const [id, value] of [['displayName', 'Meta Tester'], ['status', 'testing things'], ['homepage', 'https://example.com/meta']] as const) {
      await openProfileSettings(page, 'profile');
      const field = page.locator(`#${id}`);
      await expect(field).toBeVisible({ timeout: 10_000 });
      await field.fill(value);
      await field.press('Enter');
      await expect(page.getByRole('dialog')).toBeHidden();
    }

    await expect(page.getByTestId('users-sidebar').getByText('Meta Tester')).toBeVisible({ timeout: 10_000 });
    // What the server now holds for everyone else
    const capture = bot.captureLines();
    bot.send(`METADATA ${nick} GET display-name status homepage`);
    await expect.poll(() => capture.lines.filter((line) => / 761 /.test(line)).join('\n'), { timeout: 10_000 })
      .toMatch(/display-name \S+ :Meta Tester[\s\S]*status \S+ :testing things[\s\S]*homepage \S+ :?https:\/\/example\.com\/meta/);
    capture.stop();
  });

  test('bot metadata update is visible to browser user', async () => {
    const avatarUrl = 'https://simpleircclient.com/assets/test-image.jpg';

    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText(`metabot-${tag}`)).toBeVisible({ timeout: 10_000 });

    // Bot sets its avatar via raw METADATA command
    bot.send(`METADATA * SET avatar :${avatarUrl}`);

    // Avatar should load and stay visible (not swap to fallback letter)
    await expectImageLoaded(usersSidebar.locator(`img[src="${avatarUrl}"]`));
  });

  // Channel avatar tests for each image format. These use real image files
  // served from the Vite dev server's public/ directory. A previous bug had
  // workbox runtimeCaching intercept image fetches and reject with "no-response",
  // breaking the Avatar component entirely.
  for (const ext of ['webp', 'jpg', 'svg', 'png'] as const) {
    test(`channel avatar renders ${ext} image`, async () => {
      const avatarUrl = `https://simpleircclient.com/assets/test-image.${ext}`;
      const channelNav = page.getByTestId('channels-sidebar');
      const channelButton = channelNav.getByRole('button', { name: `#metadata-test-${tag}`, exact: true });

      // Collect page errors to detect service worker "no-response" rejections
      const pageErrors: string[] = [];
      const onPageError = (error: Error) => { pageErrors.push(error.message); };
      page.on('pageerror', onPageError);

      // Bot (channel operator) sets the channel avatar
      bot.send(`METADATA #metadata-test-${tag} SET avatar :${avatarUrl}`);

      // A service worker that intercepted and rejected the fetch would keep the image from loading
      await expectImageLoaded(channelButton.locator(`img[src="${avatarUrl}"]`));

      page.off('pageerror', onPageError);

      // No service worker "no-response" errors should have occurred
      const swErrors = pageErrors.filter((msg) => msg.includes('no-response'));
      expect(swErrors).toHaveLength(0);
    });
  }
});

