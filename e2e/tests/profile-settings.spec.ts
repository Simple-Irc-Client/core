import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('settingsbot');
  await bot.join('#settings');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'settings-user', { channels: ['#settings'] });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Profile settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens profile settings dialog', async () => {
    // Open user menu via avatar button
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Dialog should be visible with title
    await expect(sharedPage.getByRole('dialog')).toBeVisible();
    await expect(sharedPage.getByText('Profile Settings')).toBeVisible();

    // Should show nickname field
    await expect(sharedPage.getByLabel('Nickname')).toBeVisible();

    // Close dialog so subsequent tests start clean
    await sharedPage.keyboard.press('Escape');
  });

  test('changes nickname from profile settings', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Change nickname
    const nickInput = sharedPage.getByLabel('Nickname');
    await nickInput.clear();
    await nickInput.fill('new-nick');
    await sharedPage.getByRole('button', { name: 'Set' }).first().click();

    // Close dialog
    await sharedPage.keyboard.press('Escape');

    // The users sidebar should now show the new nick
    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('new-nick')).toBeVisible({ timeout: 10_000 });
  });

  test('toggles layout between Classic and Modern', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Find layout buttons
    const classicButton = sharedPage.getByTestId('layout-classic');
    const modernButton = sharedPage.getByTestId('layout-modern');

    // One should be pressed
    const classicPressed = await classicButton.getAttribute('aria-pressed');
    const modernPressed = await modernButton.getAttribute('aria-pressed');
    expect(classicPressed === 'true' || modernPressed === 'true').toBe(true);

    // Click the other one
    if (classicPressed === 'true') {
      await modernButton.click();
      await expect(modernButton).toHaveAttribute('aria-pressed', 'true');
      await expect(classicButton).toHaveAttribute('aria-pressed', 'false');
    } else {
      await classicButton.click();
      await expect(classicButton).toHaveAttribute('aria-pressed', 'true');
      await expect(modernButton).toHaveAttribute('aria-pressed', 'false');
    }

    // Close dialog
    await sharedPage.keyboard.press('Escape');
  });

  test('changes font size', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    const smallButton = sharedPage.getByTestId('font-size-small');
    const mediumButton = sharedPage.getByTestId('font-size-medium');
    const largeButton = sharedPage.getByTestId('font-size-large');

    // Click Large
    await largeButton.click();
    await expect(largeButton).toHaveAttribute('aria-pressed', 'true');
    await expect(smallButton).toHaveAttribute('aria-pressed', 'false');
    await expect(mediumButton).toHaveAttribute('aria-pressed', 'false');

    // Click Small
    await smallButton.click();
    await expect(smallButton).toHaveAttribute('aria-pressed', 'true');
    await expect(largeButton).toHaveAttribute('aria-pressed', 'false');

    // Close dialog
    await sharedPage.keyboard.press('Escape');
  });

  test('toggles hide avatars', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    const toggle = sharedPage.getByTestId('hide-avatars-toggle');
    const initialChecked = await toggle.isChecked();

    // Toggle it
    await toggle.click();
    if (initialChecked) {
      await expect(toggle).not.toBeChecked();
    } else {
      await expect(toggle).toBeChecked();
    }

    // Toggle back
    await toggle.click();
    if (initialChecked) {
      await expect(toggle).toBeChecked();
    } else {
      await expect(toggle).not.toBeChecked();
    }

    // Close dialog
    await sharedPage.keyboard.press('Escape');
  });
});
