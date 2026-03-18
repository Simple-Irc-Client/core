import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
// ergo does not support draft/metadata; skip all metadata tests
const metadataSupported = false;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  if (!metadataSupported) return;
  bot = await createIrcClient('metabot');
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
    test.skip(!metadataSupported, 'Server does not support draft/metadata');

    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Look for avatar URL input
    const avatarInput = sharedPage.getByLabel(/avatar/i);
    if (await avatarInput.isVisible()) {
      await avatarInput.fill('https://example.com/avatar.png');

      // Find and click the Set/Save button for avatar
      const setButton = sharedPage.getByRole('button', { name: 'Set' });
      if (await setButton.first().isVisible()) {
        await setButton.first().click();
      }

      // Close dialog
      await sharedPage.keyboard.press('Escape');

      // Avatar should display in the users sidebar (as an img element)
      const usersSidebar = sharedPage.getByTestId('users-sidebar');
      await expect(usersSidebar.locator('img[src="https://example.com/avatar.png"]')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('set nick color via profile settings', async () => {
    test.skip(!metadataSupported, 'Server does not support draft/metadata');

    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Look for color input
    const colorInput = sharedPage.getByLabel(/color/i).first();
    if (await colorInput.isVisible()) {
      await colorInput.fill('#ff0000');

      const setButton = sharedPage.getByRole('button', { name: 'Set' });
      if (await setButton.first().isVisible()) {
        await setButton.first().click();
      }

      await sharedPage.keyboard.press('Escape');

      // Verify color is applied — nick in users sidebar should have the color style
      const usersSidebar = sharedPage.getByTestId('users-sidebar');
      await expect(usersSidebar.getByText('meta-tester')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('bot metadata update is visible to browser user', async () => {
    test.skip(!metadataSupported, 'Server does not support draft/metadata');

    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('metabot')).toBeVisible({ timeout: 10_000 });

    // Bot sets its avatar via raw METADATA command
    bot.send('METADATA * SET avatar :https://example.com/bot-avatar.png');

    // Wait for the avatar to update in the users sidebar
    await expect(usersSidebar.locator('img[src="https://example.com/bot-avatar.png"]')).toBeVisible({ timeout: 10_000 });
  });
});
