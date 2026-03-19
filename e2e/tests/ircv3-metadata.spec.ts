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

    // Open profile settings
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    // Avatar input is conditionally rendered when the server supports metadata
    const avatarInput = sharedPage.locator('#avatar');
    await expect(avatarInput).toBeVisible({ timeout: 10_000 });
    await avatarInput.fill('https://example.com/avatar.png');
    await avatarInput.press('Enter');

    // Close dialog
    await sharedPage.keyboard.press('Escape');

    // Avatar should display in the users sidebar (as an img element)
    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar.locator('img[src="https://example.com/avatar.png"]')).toBeVisible({ timeout: 10_000 });
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

    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar.getByText('metabot')).toBeVisible({ timeout: 10_000 });

    // Bot sets its avatar via raw METADATA command
    bot.send('METADATA * SET avatar :https://example.com/bot-avatar.png');

    // Wait for the avatar to update in the users sidebar
    await expect(usersSidebar.locator('img[src="https://example.com/bot-avatar.png"]')).toBeVisible({ timeout: 10_000 });
  });
});
