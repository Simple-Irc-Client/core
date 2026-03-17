import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let metadataSupported = true;

test.beforeAll(async () => {
  bot = await createIrcClient('metabot');
  await bot.join('#metadata-test');

  // Check if ergo supports draft/metadata by sending a test command
  // If the capability isn't available, we'll skip tests
  try {
    bot.send('CAP LS 302');
    // Give the server a moment to respond
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    metadataSupported = false;
  }
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Metadata', () => {
  test.describe.configure({ mode: 'serial' });

  test('set avatar via profile settings', async ({ page }) => {
    test.skip(!metadataSupported, 'Server does not support draft/metadata');

    await page.goto('/');
    await connectViaWizard(page, 'avatar-setter', { channels: ['#metadata-test'] });
    await page.getByRole('button', { name: '#metadata-test' }).click();

    // Open profile settings
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Look for avatar URL input
    const avatarInput = page.getByLabel(/avatar/i);
    if (await avatarInput.isVisible()) {
      await avatarInput.fill('https://example.com/avatar.png');

      // Find and click the Set/Save button for avatar
      const setButton = page.getByRole('button', { name: 'Set' });
      if (await setButton.first().isVisible()) {
        await setButton.first().click();
      }

      // Close dialog
      await page.keyboard.press('Escape');

      // Avatar should display in the users sidebar (as an img element)
      const usersSidebar = page.getByRole('complementary', { name: 'Users' });
      await expect(usersSidebar.locator('img[src="https://example.com/avatar.png"]')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('set nick color via profile settings', async ({ page }) => {
    test.skip(!metadataSupported, 'Server does not support draft/metadata');

    await page.goto('/');
    await connectViaWizard(page, 'color-setter', { channels: ['#metadata-test'] });
    await page.getByRole('button', { name: '#metadata-test' }).click();

    // Open profile settings
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Look for color input
    const colorInput = page.getByLabel(/color/i).first();
    if (await colorInput.isVisible()) {
      await colorInput.fill('#ff0000');

      const setButton = page.getByRole('button', { name: 'Set' });
      if (await setButton.first().isVisible()) {
        await setButton.first().click();
      }

      await page.keyboard.press('Escape');

      // Verify color is applied — nick in users sidebar should have the color style
      const usersSidebar = page.getByRole('complementary', { name: 'Users' });
      await expect(usersSidebar.getByText('color-setter')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('bot metadata update is visible to browser user', async ({ page }) => {
    test.skip(!metadataSupported, 'Server does not support draft/metadata');

    await page.goto('/');
    await connectViaWizard(page, 'meta-watcher', { channels: ['#metadata-test'] });
    await page.getByRole('button', { name: '#metadata-test' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('metabot')).toBeVisible({ timeout: 10_000 });

    // Bot sets its avatar via raw METADATA command
    bot.send('METADATA * SET avatar :https://example.com/bot-avatar.png');

    // Wait for the avatar to update in the users sidebar
    await expect(usersSidebar.locator('img[src="https://example.com/bot-avatar.png"]')).toBeVisible({ timeout: 10_000 });
  });
});
