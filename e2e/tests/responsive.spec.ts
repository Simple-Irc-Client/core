import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

test.describe('Responsive layout', () => {
  test.describe.configure({ mode: 'serial' });

  let bot: IrcClient;
  let sharedPage: Page;
  // Per-project nicks/channel: chromium and firefox run this file concurrently
  // against the same ergo server.
  let botNick: string;
  let channel: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    const suffix = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
    botNick = `mobilebot-${suffix}`;
    channel = `#responsive-${suffix}`;
    bot = await createIrcClient(botNick);
    await bot.join(channel);

    sharedPage = await browser.newPage();
    // Start at a small mobile viewport
    await sharedPage.setViewportSize({ width: 375, height: 667 });
    await sharedPage.goto('/');
    await connectViaWizard(sharedPage, `mobile-tester-${suffix}`, { channels: [channel] });
  });

  test.afterAll(async () => {
    await sharedPage?.close();
    bot?.disconnect();
  });

  // --- Mobile viewport ---

  test('channels sidebar is hidden by default on mobile', async () => {
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav).not.toBeVisible();
  });

  test('users sidebar is hidden by default on mobile', async () => {
    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar).not.toBeVisible();
  });

  test('toggle channels button is visible on mobile', async () => {
    const toggleChannels = sharedPage.getByRole('button', { name: /toggle channels/i });
    await expect(toggleChannels).toBeVisible();
  });

  test('opening channels drawer shows sidebar as overlay', async () => {
    await sharedPage.getByRole('button', { name: /toggle channels/i }).click();

    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav).toBeVisible({ timeout: 5_000 });

    // The test channel should be in the channel list
    await expect(channelNav.getByRole('button', { name: channel, exact: true })).toBeVisible();
  });

  test('clicking a channel closes the drawer', async () => {
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await channelNav.getByRole('button', { name: channel, exact: true }).click();

    // Drawer should close automatically on mobile
    await expect(channelNav).not.toBeVisible({ timeout: 5_000 });

    // Chat area should show the channel content
    await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  });

  test('toggle users button is visible on mobile', async () => {
    const toggleUsers = sharedPage.getByRole('button', { name: /toggle users/i });
    await expect(toggleUsers).toBeVisible();
  });

  test('opening users drawer shows sidebar as overlay', async () => {
    await sharedPage.getByRole('button', { name: /toggle users/i }).click();

    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar).toBeVisible({ timeout: 5_000 });

    // Bot should be visible in users list
    await expect(usersSidebar.getByText(botNick, { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('close button hides the users drawer', async () => {
    const closeButton = sharedPage.getByRole('button', { name: /close users/i });
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    const usersSidebar = sharedPage.getByTestId('users-sidebar');
    await expect(usersSidebar).not.toBeVisible({ timeout: 5_000 });
  });

  test('channels drawer has close button', async () => {
    await sharedPage.getByRole('button', { name: /toggle channels/i }).click();

    const closeButton = sharedPage.getByRole('button', { name: /close channels/i });
    await expect(closeButton).toBeVisible({ timeout: 5_000 });
    await closeButton.click();

    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav).not.toBeVisible({ timeout: 5_000 });
  });

  test('opening one drawer closes the other', async () => {
    // Open channels drawer
    await sharedPage.getByRole('button', { name: /toggle channels/i }).click();
    await expect(sharedPage.getByTestId('channels-sidebar')).toBeVisible({ timeout: 5_000 });

    // Close it first since toggle buttons are hidden when a drawer is open
    await sharedPage.getByRole('button', { name: /close channels/i }).click();
    await expect(sharedPage.getByTestId('channels-sidebar')).not.toBeVisible({ timeout: 5_000 });

    // Open users drawer
    await sharedPage.getByRole('button', { name: /toggle users/i }).click();
    await expect(sharedPage.getByTestId('users-sidebar')).toBeVisible({ timeout: 5_000 });

    // Channels sidebar should not be visible
    await expect(sharedPage.getByTestId('channels-sidebar')).not.toBeVisible();

    // Clean up: close users drawer
    await sharedPage.getByRole('button', { name: /close users/i }).click();
  });

  test('chat messages are visible and scrollable on mobile', async () => {
    // Ensure we're on the channel
    await sharedPage.getByRole('button', { name: /toggle channels/i }).click();
    await sharedPage.getByRole('button', { name: channel, exact: true }).click();
    await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });

    // Send messages and verify they're visible
    bot.sendMessage(channel, 'Mobile message 1');
    bot.sendMessage(channel, 'Mobile message 2');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Mobile message 2')).toBeVisible({ timeout: 10_000 });

    // Chat should be scrollable
    const isScrollable = await chatLog.evaluate((el) => el.scrollHeight >= el.clientHeight);
    expect(isScrollable).toBe(true);
  });

  test('message input works on mobile', async () => {
    const messageInput = sharedPage.locator('#message-input');
    await messageInput.fill('Hello from mobile!');
    await messageInput.press('Enter');

    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from mobile!')).toBeVisible({ timeout: 10_000 });
  });

  test('profile settings dialog fits the viewport and scrolls on mobile', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();

    const dialog = sharedPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Wait for the open animation (zoom/slide) to settle before measuring
    await expect(dialog).not.toHaveAttribute('data-state', 'closed');
    await sharedPage.waitForFunction(() =>
      document.querySelector('[role="dialog"]')?.getAnimations().length === 0,
    );

    const viewport = sharedPage.viewportSize();
    const box = await dialog.boundingBox();
    if (!viewport || !box) { throw new Error('dialog or viewport has no measurable size'); }
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

    // Content is taller than a phone screen, so the dialog itself must scroll
    const isScrollable = await dialog.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    // Both the first and the last control must be reachable
    await expect(sharedPage.getByLabel('Nickname')).toBeInViewport();
    const languageSelect = sharedPage.getByTestId('language-select');
    await languageSelect.scrollIntoViewIfNeeded();
    await expect(languageSelect).toBeInViewport({ ratio: 1 });

    await sharedPage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  // --- Tablet viewport ---

  test('drawers still work at 768px width', async () => {
    await sharedPage.setViewportSize({ width: 768, height: 1024 });
    await sharedPage.waitForTimeout(300);

    // Sidebars should still be hidden (768 < 1024 lg breakpoint)
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav).not.toBeVisible();

    // Toggle buttons should be visible
    await expect(sharedPage.getByRole('button', { name: /toggle channels/i })).toBeVisible();

    // Open and verify channels drawer
    await sharedPage.getByRole('button', { name: /toggle channels/i }).click();
    await expect(channelNav).toBeVisible({ timeout: 5_000 });

    // Close it
    await sharedPage.getByRole('button', { name: /close channels/i }).click();
  });

  // --- Desktop viewport ---

  test('sidebars are always visible on desktop', async () => {
    await sharedPage.setViewportSize({ width: 1280, height: 800 });
    await sharedPage.waitForTimeout(300);

    // Both sidebars should be visible without toggling
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    await expect(channelNav).toBeVisible({ timeout: 5_000 });
    await expect(usersSidebar).toBeVisible({ timeout: 5_000 });
  });

  test('toggle buttons are hidden on desktop', async () => {
    await expect(sharedPage.getByRole('button', { name: /toggle channels/i })).not.toBeVisible();
    await expect(sharedPage.getByRole('button', { name: /toggle users/i })).not.toBeVisible();
  });
});
