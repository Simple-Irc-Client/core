import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`settingsbot-${tag}`);
  await bot.join(`#settings-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `settings-user-${tag}`, { channels: [`#settings-${tag}`] });
});

test.afterEach(() => {
  bot.disconnect();
});

test.describe('Profile settings', () => {
  test('opens profile settings dialog', async () => {
    // Open user menu via avatar button
    await expect(page.locator('[data-avatar-button]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-avatar-button]').click();
    await expect(page.getByRole('menuitem', { name: 'Profile Settings' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Dialog should be visible with title
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile Settings' })).toBeVisible();

    // Opens on the Profile tab, with the others one click away
    await expect(page.getByRole('tab')).toHaveText(['Profile', 'Appearance', 'Notifications', 'Privacy']);
    await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Nickname')).toBeVisible();
  });

  test('every tab fits the dialog without scrolling, and switching tabs keeps its size', async () => {
    await openProfileSettings(page, 'profile');
    const dialog = page.getByRole('dialog');
    const measure = () => dialog.evaluate((element) => {
      const panels = element.querySelector('[role="tabpanel"]')?.parentElement as HTMLElement;
      return { height: Math.round(element.getBoundingClientRect().height), overflow: panels.scrollHeight - panels.clientHeight };
    });
    const first = await measure();

    for (const tab of ['Profile', 'Appearance', 'Notifications', 'Privacy']) {
      await page.getByRole('tab', { name: tab }).click();
      expect(await measure()).toEqual({ height: first.height, overflow: 0 });
    }
    // The other tabs keep their space, but out of sight
    await expect(page.getByLabel('Nickname')).toBeHidden();
  });

  test('changes nickname from profile settings', async () => {
    // Open profile settings
    await openProfileSettings(page, 'profile');

    // Change nickname
    const nickInput = page.getByLabel('Nickname');
    await nickInput.clear();
    await nickInput.fill(`new-nick-${tag}`);
    await page.getByRole('button', { name: 'Set' }).first().click();

    // Close dialog
    await page.keyboard.press('Escape');

    // The users sidebar should now show the new nick
    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText(`new-nick-${tag}`)).toBeVisible({ timeout: 10_000 });
  });

  test('switches theme between Classic and Modern', async () => {
    // Open profile settings
    await openProfileSettings(page, 'appearance');

    const themeSelect = page.getByTestId('theme-select');
    await expect(themeSelect).toBeVisible();

    // Pick the builtin theme that is not currently active
    const current = await themeSelect.textContent();
    const target = current?.includes('Classic') ? 'modern' : 'classic';
    await themeSelect.click();
    await page.getByTestId(`theme-${target}`).click();

    await expect(themeSelect).toContainText(target === 'classic' ? 'Classic' : 'Modern');

    // The injected theme stylesheet should follow the switch
    const injectedCss = await page.locator('#sic-theme').textContent();
    expect(injectedCss).toContain(target === 'classic' ? 'Classic theme' : 'Modern theme');
  });

  test('edits theme CSS with live apply and resets to default', async () => {
    // Make sure at least one chat message exists to assert the applied styling on
    bot.sendMessage(`#settings-${tag}`, 'theme test message');
    await expect(page.locator('.sic-msg').first()).toBeVisible({ timeout: 10_000 });

    // Open profile settings
    await openProfileSettings(page, 'appearance');

    // Edit opens the Creator; its "Edit CSS" button switches to the CSS editor
    await page.getByTestId('theme-edit').click();
    await page.getByTestId('creator-edit-css').click();
    const editor = page.getByTestId('theme-css-editor');
    await expect(editor).toBeVisible();

    // Type a recognizable rule into the real CodeMirror editor
    await editor.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('.sic-msg { background-color: rgb(1, 2, 3); }');
    await page.getByTestId('theme-save').click();

    // The saved CSS is injected and applied to chat messages
    // (<style> has no visible text, so assert on textContent)
    expect(await page.locator('#sic-theme').textContent()).toContain('rgb(1, 2, 3)');
    await expect(page.locator('.sic-msg').first()).toHaveCSS('background-color', 'rgb(1, 2, 3)');

    // Reset to the shipped default
    await page.getByTestId('theme-edit').click();
    await page.getByTestId('creator-edit-css').click();
    await page.getByTestId('theme-reset').click();
    await page.getByTestId('theme-save').click();

    const resetCss = await page.locator('#sic-theme').textContent();
    expect(resetCss).not.toContain('rgb(1, 2, 3)');
  });

  test('creates and deletes a custom theme', async () => {
    // Open profile settings
    await openProfileSettings(page, 'appearance');

    // New theme opens the Creator; switch to the CSS editor and save from there
    await page.getByTestId('theme-new').click();
    await page.getByTestId('creator-edit-css').click();
    const nameInput = page.getByTestId('theme-name');
    await nameInput.clear();
    await nameInput.fill('E2E theme');
    await page.getByTestId('theme-save').click();

    // The new theme becomes active and deletable
    await expect(page.getByTestId('theme-select')).toContainText('E2E theme');
    await expect(page.getByTestId('theme-delete')).toBeVisible();

    // Deleting it falls back to the Modern builtin
    await page.getByTestId('theme-delete').click();
    await expect(page.getByTestId('theme-select')).toContainText('Modern');
    await expect(page.getByTestId('theme-delete')).not.toBeVisible();
  });

  test('creates a theme with the Theme Creator', async () => {
    // Open profile settings
    await openProfileSettings(page, 'appearance');

    await page.getByTestId('theme-new').click();

    const nameInput = page.getByTestId('creator-theme-name');
    await nameInput.clear();
    await nameInput.fill('Creator theme');

    // Pick the classic base and a custom join color
    await page.getByTestId('creator-base-classic').click();
    await page.getByTestId('creator-color-light-join').fill('#123456');
    await page.getByTestId('creator-save').click();

    // The generated theme is active and its palette is injected
    await expect(page.getByTestId('theme-select')).toContainText('Creator theme');
    const injectedCss = await page.locator('#sic-theme').textContent();
    expect(injectedCss).toContain('--msg-join: #123456;');
    expect(injectedCss).toContain('sic-creator:1');

    // Re-opening the creator restores the settings from the CSS marker
    await page.getByTestId('theme-edit').click();
    await expect(page.getByTestId('creator-base-classic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('creator-color-light-join')).toHaveValue('#123456');
    await page.getByTestId('creator-cancel').click();
  });

  test('changes font size', async () => {
    // Open profile settings
    await openProfileSettings(page, 'appearance');

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

  test('toggles hide avatars', async () => {
    // Open profile settings
    await openProfileSettings(page, 'appearance');

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
