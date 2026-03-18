import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  bot = await createIrcClient('langbot');
  await bot.join('#language');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'lang-tester', { channels: ['#language'] });
  await sharedPage.getByRole('button', { name: '#language', exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('Language switching', () => {
  test.describe.configure({ mode: 'serial' });

  test('profile settings shows language selector', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible();

    // Language selector should be visible
    await expect(sharedPage.getByTestId('language-select')).toBeVisible();

    // "Nickname" label should be in English by default
    await expect(sharedPage.getByLabel('Nickname')).toBeVisible();

    await sharedPage.keyboard.press('Escape');
  });

  test('switching to Polish translates UI', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible();

    // Open language select
    await sharedPage.getByTestId('language-select').click();
    await sharedPage.getByTestId('language-pl').click();

    // UI should now be in Polish
    // "Nickname" → "Pseudonim"
    await expect(sharedPage.getByLabel('Pseudonim')).toBeVisible({ timeout: 5_000 });

    // Dialog title should be in Polish
    await expect(sharedPage.getByText('Ustawienia profilu')).toBeVisible();

    // "Layout" → "Układ"
    await expect(sharedPage.getByText('Układ')).toBeVisible();

    await sharedPage.keyboard.press('Escape');
  });

  test('switching back to English restores UI', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    // Menu item should be in Polish now
    await sharedPage.getByRole('menuitem', { name: 'Ustawienia profilu' }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible();

    // Switch back to English
    await sharedPage.getByTestId('language-select').click();
    await sharedPage.getByTestId('language-en').click();

    // "Pseudonim" → "Nickname"
    await expect(sharedPage.getByLabel('Nickname')).toBeVisible({ timeout: 5_000 });
    await expect(sharedPage.getByText('Profile Settings')).toBeVisible();

    await sharedPage.keyboard.press('Escape');
  });

  test('auto language uses browser locale', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible();

    // Switch to auto
    await sharedPage.getByTestId('language-select').click();
    await sharedPage.getByTestId('language-auto').click();

    // Since the browser locale is English by default in Playwright,
    // UI should remain in English
    await expect(sharedPage.getByLabel('Nickname')).toBeVisible({ timeout: 5_000 });

    await sharedPage.keyboard.press('Escape');
  });
});
