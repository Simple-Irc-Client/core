import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, testTag } from '../helpers';

let bot: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  bot = await createIrcClient(`langbot-${tag}`);
  await bot.join(`#language-${tag}`);

  await page.goto('/');
  await connectViaWizard(page, `lang-tester-${tag}`, { channels: [`#language-${tag}`] });
  await page.getByRole('button', { name: `#language-${tag}`, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterEach(() => {
  bot.disconnect();
});

/** Picks a language in the open settings, and waits until the Select is closed */
const chooseLanguage = async (code: 'en' | 'pl' | 'auto'): Promise<void> => {
  await page.getByTestId('language-select').click();
  await page.getByTestId(`language-${code}`).click();
  // Radix Select hands focus back to its trigger once its closing animation ends; an Escape before that closes the Select, not the dialog
  await expect(page.getByTestId('language-select')).toBeFocused();
};

test.describe('Language switching', () => {
  test('profile settings shows language selector', async () => {
    await openProfileSettings(page, 'appearance');
    await expect(page.getByRole('dialog')).toBeVisible();

    // Language selector should be visible
    await expect(page.getByTestId('language-select')).toBeVisible();

    // Tab names should be in English by default
    await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible();
  });

  test('switching to Polish translates UI', async () => {
    await openProfileSettings(page, 'appearance');
    await expect(page.getByRole('dialog')).toBeVisible();

    await chooseLanguage('pl');

    // UI should now be in Polish
    // "Appearance" → "Wygląd"
    await expect(page.getByRole('tab', { name: 'Wygląd' })).toBeVisible({ timeout: 5_000 });

    // Dialog title should be in Polish
    await expect(page.getByText('Ustawienia profilu')).toBeVisible();

    // "Theme" → "Motyw"
    await expect(page.getByText('Motyw', { exact: true })).toBeVisible();
  });

  test('switching back to English restores UI', async () => {
    await openProfileSettings(page, 'appearance');
    await chooseLanguage('pl');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.locator('[data-avatar-button]').click();
    // Menu item should be in Polish now
    await page.getByRole('menuitem', { name: 'Ustawienia profilu' }).click();
    await page.getByTestId('profile-tab-appearance').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await chooseLanguage('en');

    // "Wygląd" → "Appearance"
    await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Profile Settings')).toBeVisible();
  });

  test('auto language uses browser locale', async () => {
    await openProfileSettings(page, 'appearance');
    await expect(page.getByRole('dialog')).toBeVisible();

    await chooseLanguage('auto');

    // Since the browser locale is English by default in Playwright,
    // UI should remain in English
    await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible({ timeout: 5_000 });
  });
});
