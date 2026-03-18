import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;

test.beforeAll(async () => {
  // Bot joins a channel so ergo has at least one channel visible in LIST
  bot = await createIrcClient('chansettingsbot');
  await bot.join('#chan-settings');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Channel settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('channel settings button is visible when user has ops', async ({ page }) => {
    await page.goto('/');
    // Connect and join #chan-settings — the bot is already there, but ergo gives ops
    // to the first user per channel. We need to create our OWN channel to get ops.
    // Skip channels from wizard, then manually join a fresh channel via message input.
    await connectViaWizard(page, 'opsuser');

    // Join a new channel where this user will be the first (and get ops)
    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #my-ops-chan');
    await messageInput.press('Enter');

    // Wait for channel to appear in sidebar and switch to it
    await expect(page.getByRole('button', { name: '#my-ops-chan', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#my-ops-chan', exact: true }).click();

    // Channel settings button should be visible (user has ops as first joiner)
    await expect(page.getByTestId('channel-settings-button')).toBeVisible({ timeout: 5_000 });
  });

  test('opens channel settings dialog', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'settings-opener');

    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #settings-dialog-chan');
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: '#settings-dialog-chan', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#settings-dialog-chan', exact: true }).click();

    // Click channel settings button
    await page.getByTestId('channel-settings-button').click({ timeout: 5_000 });

    // Dialog should appear with channel name in title
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Channel Settings - #settings-dialog-chan')).toBeVisible();
  });

  test('shows modes tab with channel flags', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'modes-viewer');

    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #modes-test-chan');
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: '#modes-test-chan', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#modes-test-chan', exact: true }).click();

    await page.getByTestId('channel-settings-button').click({ timeout: 5_000 });

    // Modes tab should be visible and active by default
    await expect(page.getByTestId('tab-modes')).toBeVisible();

    // Channel flags section should show toggleable modes
    await expect(page.getByText('No external messages')).toBeVisible();
    await expect(page.getByText('Topic lock')).toBeVisible();
    await expect(page.getByText('Invite only')).toBeVisible();
  });

  test('can toggle channel mode', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'mode-toggler');

    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #toggle-mode-chan');
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: '#toggle-mode-chan', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#toggle-mode-chan', exact: true }).click();

    await page.getByTestId('channel-settings-button').click({ timeout: 5_000 });

    // Toggle invite-only mode
    const inviteSwitch = page.getByTestId('mode-switch-i');
    const initialChecked = await inviteSwitch.isChecked();

    await inviteSwitch.click();

    // Wait for mode change to round-trip through the server
    await page.waitForTimeout(1000);

    // Mode should have toggled
    if (initialChecked) {
      await expect(inviteSwitch).not.toBeChecked({ timeout: 10_000 });
    } else {
      await expect(inviteSwitch).toBeChecked({ timeout: 10_000 });
    }
  });

  test('shows lists tab with ban list', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'lists-viewer');

    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #lists-test-chan');
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: '#lists-test-chan', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#lists-test-chan', exact: true }).click();

    await page.getByTestId('channel-settings-button').click({ timeout: 5_000 });

    // Switch to Lists tab
    await page.getByTestId('tab-lists').click();

    // List type buttons should be visible
    await expect(page.getByTestId('list-type-bans')).toBeVisible();
    await expect(page.getByTestId('list-type-exceptions')).toBeVisible();
    await expect(page.getByTestId('list-type-invites')).toBeVisible();

    // Empty state should show
    await expect(page.getByText('No entries')).toBeVisible();
  });

  test('can add and remove a ban entry', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'ban-tester');

    const messageInput = page.locator('#message-input');
    await messageInput.fill('/join #ban-test-chan');
    await messageInput.press('Enter');

    await expect(page.getByRole('button', { name: '#ban-test-chan', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '#ban-test-chan', exact: true }).click();

    await page.getByTestId('channel-settings-button').click({ timeout: 5_000 });

    // Switch to Lists tab
    await page.getByTestId('tab-lists').click();

    // Bans tab should be active by default
    await expect(page.getByTestId('list-type-bans')).toHaveAttribute('aria-pressed', 'true');

    // Add a ban entry
    await page.getByTestId('new-entry-input').fill('*!*@banned.host');
    await page.getByTestId('add-entry').click();

    // Ban entry should appear in the list
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('*!*@banned.host')).toBeVisible({ timeout: 5_000 });

    // Remove the ban entry
    await dialog.getByTestId('remove-entry-0').click();

    // Entry should be removed
    await expect(dialog.getByText('*!*@banned.host')).not.toBeVisible({ timeout: 5_000 });
  });

  test('channel settings button is hidden without ops', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'noops-user', { channels: ['#chan-settings'] });

    // Switch to #chan-settings — the bot created this channel and has ops, not this user
    await page.getByRole('button', { name: '#chan-settings', exact: true }).click();

    // Channel settings button should NOT be visible (no ops)
    await expect(page.getByTestId('channel-settings-button')).not.toBeVisible({ timeout: 3_000 });
  });
});
