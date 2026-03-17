import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('settingsbot');
  await bot.join('#settings');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Profile settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens profile settings dialog', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'settings-user', { channels: ['#settings'] });

    // Open user menu via avatar button
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Dialog should be visible with title
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Profile Settings')).toBeVisible();

    // Should show nickname field
    await expect(page.getByLabel('Nickname')).toBeVisible();
  });

  test('changes nickname from profile settings', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'nick-changer', { channels: ['#settings'] });

    // Open profile settings
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Change nickname
    const nickInput = page.getByLabel('Nickname');
    await nickInput.clear();
    await nickInput.fill('new-nick');
    await page.getByRole('button', { name: 'Set' }).first().click();

    // Close dialog
    await page.keyboard.press('Escape');

    // The users sidebar should now show the new nick
    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('new-nick')).toBeVisible({ timeout: 10_000 });
  });

  test('toggles layout between Classic and Modern', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'layout-user', { channels: ['#settings'] });

    // Open profile settings
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Find layout buttons
    const classicButton = page.getByTestId('layout-classic');
    const modernButton = page.getByTestId('layout-modern');

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
  });

  test('changes font size', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'font-user', { channels: ['#settings'] });

    // Open profile settings
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    const smallButton = page.getByTestId('font-size-small');
    const mediumButton = page.getByTestId('font-size-medium');
    const largeButton = page.getByTestId('font-size-large');

    // Click Large
    await largeButton.click();
    await expect(largeButton).toHaveAttribute('aria-pressed', 'true');
    await expect(smallButton).toHaveAttribute('aria-pressed', 'false');
    await expect(mediumButton).toHaveAttribute('aria-pressed', 'false');

    // Click Small
    await smallButton.click();
    await expect(smallButton).toHaveAttribute('aria-pressed', 'true');
    await expect(largeButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('toggles hide avatars', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'avatar-toggle-user', { channels: ['#settings'] });

    // Open profile settings
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    const toggle = page.getByTestId('hide-avatars-toggle');
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
  });
});
