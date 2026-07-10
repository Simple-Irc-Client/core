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
    await expect(sharedPage.locator('[data-avatar-button]')).toBeVisible({ timeout: 10_000 });
    await sharedPage.locator('[data-avatar-button]').click();
    await expect(sharedPage.getByRole('menuitem', { name: 'Profile Settings' })).toBeVisible({ timeout: 5_000 });
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Dialog should be visible with title
    await expect(sharedPage.getByRole('dialog')).toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Profile Settings' })).toBeVisible();

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

  test('switches theme between Classic and Modern', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    const themeSelect = sharedPage.getByTestId('theme-select');
    await expect(themeSelect).toBeVisible();

    // Pick the builtin theme that is not currently active
    const current = await themeSelect.textContent();
    const target = current?.includes('Classic') ? 'modern' : 'classic';
    await themeSelect.click();
    await sharedPage.getByTestId(`theme-${target}`).click();

    await expect(themeSelect).toContainText(target === 'classic' ? 'Classic' : 'Modern');

    // The injected theme stylesheet should follow the switch
    const injectedCss = await sharedPage.locator('#sic-theme').textContent();
    expect(injectedCss).toContain(target === 'classic' ? 'Classic theme' : 'Modern theme');

    // Close dialog
    await sharedPage.keyboard.press('Escape');
  });

  test('edits theme CSS with live apply and resets to default', async () => {
    // Make sure at least one chat message exists to assert the applied styling on
    bot.sendMessage('#settings', 'theme test message');
    await expect(sharedPage.locator('.sic-msg').first()).toBeVisible({ timeout: 10_000 });

    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Edit opens the Creator; its "Edit CSS" button switches to the CSS editor
    await sharedPage.getByTestId('theme-edit').click();
    await sharedPage.getByTestId('creator-edit-css').click();
    const editor = sharedPage.getByTestId('theme-css-editor');
    await expect(editor).toBeVisible();

    // Type a recognizable rule into the real CodeMirror editor
    await editor.locator('.cm-content').click();
    await sharedPage.keyboard.press('ControlOrMeta+a');
    await sharedPage.keyboard.type('.sic-msg { background-color: rgb(1, 2, 3); }');
    await sharedPage.getByTestId('theme-save').click();

    // The saved CSS is injected and applied to chat messages
    // (<style> has no visible text, so assert on textContent)
    expect(await sharedPage.locator('#sic-theme').textContent()).toContain('rgb(1, 2, 3)');
    await expect(sharedPage.locator('.sic-msg').first()).toHaveCSS('background-color', 'rgb(1, 2, 3)');

    // Reset to the shipped default
    await sharedPage.getByTestId('theme-edit').click();
    await sharedPage.getByTestId('creator-edit-css').click();
    await sharedPage.getByTestId('theme-reset').click();
    await sharedPage.getByTestId('theme-save').click();

    const resetCss = await sharedPage.locator('#sic-theme').textContent();
    expect(resetCss).not.toContain('rgb(1, 2, 3)');

    // Close dialog
    await sharedPage.keyboard.press('Escape');
  });

  test('creates and deletes a custom theme', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // New theme opens the Creator; switch to the CSS editor and save from there
    await sharedPage.getByTestId('theme-new').click();
    await sharedPage.getByTestId('creator-edit-css').click();
    const nameInput = sharedPage.getByTestId('theme-name');
    await nameInput.clear();
    await nameInput.fill('E2E theme');
    await sharedPage.getByTestId('theme-save').click();

    // The new theme becomes active and deletable
    await expect(sharedPage.getByTestId('theme-select')).toContainText('E2E theme');
    await expect(sharedPage.getByTestId('theme-delete')).toBeVisible();

    // Deleting it falls back to the Modern builtin
    await sharedPage.getByTestId('theme-delete').click();
    await expect(sharedPage.getByTestId('theme-select')).toContainText('Modern');
    await expect(sharedPage.getByTestId('theme-delete')).not.toBeVisible();

    // Close dialog
    await sharedPage.keyboard.press('Escape');
  });

  test('creates a theme with the Theme Creator', async () => {
    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    await sharedPage.getByTestId('theme-new').click();

    const nameInput = sharedPage.getByTestId('creator-theme-name');
    await nameInput.clear();
    await nameInput.fill('Creator theme');

    // Pick the classic base and a custom join color
    await sharedPage.getByTestId('creator-base-classic').click();
    await sharedPage.getByTestId('creator-color-light-join').fill('#123456');
    await sharedPage.getByTestId('creator-save').click();

    // The generated theme is active and its palette is injected
    await expect(sharedPage.getByTestId('theme-select')).toContainText('Creator theme');
    const injectedCss = await sharedPage.locator('#sic-theme').textContent();
    expect(injectedCss).toContain('--msg-join: #123456;');
    expect(injectedCss).toContain('sic-creator:1');

    // Re-opening the creator restores the settings from the CSS marker
    await sharedPage.getByTestId('theme-edit').click();
    await expect(sharedPage.getByTestId('creator-base-classic')).toHaveAttribute('aria-pressed', 'true');
    await expect(sharedPage.getByTestId('creator-color-light-join')).toHaveValue('#123456');
    await sharedPage.getByTestId('creator-cancel').click();

    // Clean up: delete the theme
    await sharedPage.getByTestId('theme-delete').click();
    await expect(sharedPage.getByTestId('theme-select')).toContainText('Modern');

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
