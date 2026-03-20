import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('metabot', '127.0.0.1', 6667, ['draft/metadata-2']);
  await bot.join('#metadata-test');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'meta-tester', { channels: ['#metadata-test'] });
  await sharedPage.getByRole('button', { name: '#metadata-test', exact: true }).click();
});

test.afterAll(async () => {
  await sharedPage?.close();
  bot?.disconnect();
});

test.describe('Metadata', () => {
  test.describe.configure({ mode: 'serial' });

  test('set avatar via profile settings', async () => {
    const avatarUrl = 'https://simpleircclient.com/assets/test-image.png';

    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Avatar input is conditionally rendered when the server supports metadata
    const avatarInput = sharedPage.locator('#avatar');
    await expect(avatarInput).toBeVisible({ timeout: 10_000 });
    await avatarInput.fill(avatarUrl);
    await avatarInput.press('Enter');

    // Close dialog
    await sharedPage.keyboard.press('Escape');

    // Avatar should display in the users sidebar and actually load (not swap to fallback)
    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    const avatarImg = usersSidebar.locator(`img[src="${avatarUrl}"]`);
    await expect(avatarImg).toBeVisible({ timeout: 10_000 });
    await sharedPage.waitForTimeout(2_000);
    await expect(avatarImg).toBeVisible();
  });

  test('set nick color via profile settings', async () => {

    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Color input is conditionally rendered when the server supports metadata
    const colorInput = sharedPage.locator('#color');
    await expect(colorInput).toBeVisible({ timeout: 10_000 });
    await colorInput.fill('#ff0000');
    await colorInput.press('Enter');

    await sharedPage.keyboard.press('Escape');

    // Verify color is applied — nick in users sidebar should have the color style
    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    const nickEl = usersSidebar.getByText('meta-tester');
    await expect(nickEl).toBeVisible({ timeout: 10_000 });
    // The nick should have the chosen color applied
    await expect(nickEl).toHaveCSS('color', 'rgb(255, 0, 0)');
  });

  test('bot metadata update is visible to browser user', async () => {
    const avatarUrl = 'https://simpleircclient.com/assets/test-image.jpg';

    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('metabot')).toBeVisible({ timeout: 10_000 });

    // Bot sets its avatar via raw METADATA command
    bot.send(`METADATA * SET avatar :${avatarUrl}`);

    // Avatar should load and stay visible (not swap to fallback letter)
    const avatarImg = usersSidebar.locator(`img[src="${avatarUrl}"]`);
    await expect(avatarImg).toBeVisible({ timeout: 10_000 });
    await sharedPage.waitForTimeout(2_000);
    await expect(avatarImg).toBeVisible();
  });

  // Channel avatar tests for each image format. These use real image files
  // served from the Vite dev server's public/ directory. A previous bug had
  // workbox runtimeCaching intercept image fetches and reject with "no-response",
  // breaking the Avatar component entirely.
  for (const ext of ['webp', 'jpg', 'svg', 'png'] as const) {
    test(`channel avatar renders ${ext} image`, async () => {
      const avatarUrl = `https://simpleircclient.com/assets/test-image.${ext}`;
      const channelNav = sharedPage.getByTestId('channels-sidebar');
      const channelButton = channelNav.getByRole('button', { name: '#metadata-test', exact: true });

      // Collect page errors to detect service worker "no-response" rejections
      const pageErrors: string[] = [];
      const onPageError = (error: Error) => { pageErrors.push(error.message); };
      sharedPage.on('pageerror', onPageError);

      // Bot (channel operator) sets the channel avatar
      bot.send(`METADATA #metadata-test SET avatar :${avatarUrl}`);

      // The img must stay visible (not replaced by fallback letter), confirming
      // the image actually loaded. If the service worker intercepted and rejected
      // the fetch, onError would fire and the img would be replaced by a <span>.
      const avatarImg = channelButton.locator(`img[src="${avatarUrl}"]`);
      await expect(avatarImg).toBeVisible({ timeout: 10_000 });

      // Allow any async service worker errors to surface
      await sharedPage.waitForTimeout(2_000);

      // The img must still be visible after the wait — not swapped to fallback
      await expect(avatarImg).toBeVisible();

      sharedPage.off('pageerror', onPageError);

      // No service worker "no-response" errors should have occurred
      const swErrors = pageErrors.filter((msg) => msg.includes('no-response'));
      expect(swErrors).toHaveLength(0);
    });
  }
});

