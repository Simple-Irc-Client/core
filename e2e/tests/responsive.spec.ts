import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings, testTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

let bot: IrcClient;
let page: Page;
let botNick: string;
let channel: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  const tag = testTag(testInfo);
  botNick = `mobilebot-${tag}`;
  channel = `#responsive-${tag}`;
  bot = await createIrcClient(botNick);
  await bot.join(channel);

  await page.goto('/');
  await connectViaWizard(page, `mobile-tester-${tag}`, { channels: [channel] });
});

test.afterEach(() => {
  bot?.disconnect();
});

/** Opens the channel from the channels drawer, which closes as it does */
const openChannel = async (): Promise<void> => {
  await page.getByRole('button', { name: /toggle channels/i }).click();
  await page.getByTestId('channels-sidebar').getByRole('button', { name: channel, exact: true }).click();
  await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
};

test.describe('Responsive layout on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('channels sidebar is hidden by default on mobile', async () => {
    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav).not.toBeVisible();
  });

  test('users sidebar is hidden by default on mobile', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar).not.toBeVisible();
  });

  test('toggle channels button is visible on mobile', async () => {
    const toggleChannels = page.getByRole('button', { name: /toggle channels/i });
    await expect(toggleChannels).toBeVisible();
  });

  test('opening channels drawer shows sidebar as overlay', async () => {
    await page.getByRole('button', { name: /toggle channels/i }).click();

    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav).toBeVisible({ timeout: 5_000 });

    // The test channel should be in the channel list
    await expect(channelNav.getByRole('button', { name: channel, exact: true })).toBeVisible();
  });

  test('channels drawer shows the app version at the bottom', async () => {
    const channelNav = page.getByTestId('channels-sidebar');
    await page.getByRole('button', { name: /toggle channels/i }).click();
    const version = channelNav.getByTestId('app-version');
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^[0-9a-f]{7,}$|^unknown$/);

    // Pinned to the drawer's bottom edge, not right under the last list item
    const navBottom = await channelNav.evaluate((el) => el.getBoundingClientRect().bottom);
    const versionBottom = await version.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(navBottom - versionBottom).toBeLessThan(1);
  });

  test('clicking a channel closes the drawer', async () => {
    const channelNav = page.getByTestId('channels-sidebar');
    await page.getByRole('button', { name: /toggle channels/i }).click();
    await channelNav.getByRole('button', { name: channel, exact: true }).click();

    // Drawer should close automatically on mobile
    await expect(channelNav).not.toBeVisible({ timeout: 5_000 });

    // Chat area should show the channel content
    await expect(page.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
  });

  test('toggle users button is visible on mobile', async () => {
    await openChannel();
    const toggleUsers = page.getByRole('button', { name: /toggle users/i });
    await expect(toggleUsers).toBeVisible();
  });

  test('opening users drawer shows sidebar as overlay', async () => {
    await openChannel();
    await page.getByRole('button', { name: /toggle users/i }).click();

    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar).toBeVisible({ timeout: 5_000 });

    // Bot should be visible in users list
    await expect(usersSidebar.getByText(botNick, { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('close button hides the users drawer', async () => {
    await openChannel();
    await page.getByRole('button', { name: /toggle users/i }).click();
    const closeButton = page.getByRole('button', { name: /close users/i });
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    const usersSidebar = page.getByTestId('users-sidebar');
    await expect(usersSidebar).not.toBeVisible({ timeout: 5_000 });
  });

  test('channels drawer has close button', async () => {
    await page.getByRole('button', { name: /toggle channels/i }).click();

    const closeButton = page.getByRole('button', { name: /close channels/i });
    await expect(closeButton).toBeVisible({ timeout: 5_000 });
    await closeButton.click();

    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav).not.toBeVisible({ timeout: 5_000 });
  });

  test('opening one drawer closes the other', async () => {
    await openChannel();
    // Open channels drawer
    await page.getByRole('button', { name: /toggle channels/i }).click();
    await expect(page.getByTestId('channels-sidebar')).toBeVisible({ timeout: 5_000 });

    // Close it first since toggle buttons are hidden when a drawer is open
    await page.getByRole('button', { name: /close channels/i }).click();
    await expect(page.getByTestId('channels-sidebar')).not.toBeVisible({ timeout: 5_000 });

    // Open users drawer
    await page.getByRole('button', { name: /toggle users/i }).click();
    await expect(page.getByTestId('users-sidebar')).toBeVisible({ timeout: 5_000 });

    // Channels sidebar should not be visible
    await expect(page.getByTestId('channels-sidebar')).not.toBeVisible();
  });

  test('chat messages are visible and scrollable on mobile', async () => {
    await openChannel();

    // Send messages and verify they're visible
    bot.sendMessage(channel, 'Mobile message 1');
    bot.sendMessage(channel, 'Mobile message 2');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Mobile message 2')).toBeVisible({ timeout: 10_000 });

    // Chat should be scrollable
    const isScrollable = await chatLog.evaluate((el) => el.scrollHeight >= el.clientHeight);
    expect(isScrollable).toBe(true);
  });

  test('message input works on mobile', async () => {
    await openChannel();
    const messageInput = page.locator('#message-input');
    await messageInput.fill('Hello from mobile!');
    await messageInput.press('Enter');

    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText('Hello from mobile!')).toBeVisible({ timeout: 10_000 });
  });

  test('profile settings dialog fits the viewport on mobile', async () => {
    skipWithoutIrcv3('the METADATA fields make the Profile tab the longest');
    await openProfileSettings(page, 'profile');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Wait for the open animation (zoom/slide) to settle before measuring
    await expect(dialog).not.toHaveAttribute('data-state', 'closed');
    await page.waitForFunction(() =>
      document.querySelector('[role="dialog"]')?.getAnimations().length === 0,
    );

    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    if (!viewport || !box) { throw new Error('dialog or viewport has no measurable size'); }
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

    // Every tab fits the phone's width
    for (const tab of await page.getByRole('tab').all()) {
      await expect(tab).toBeInViewport({ ratio: 1 });
    }

    // Both the first and the last field of the Profile tab must be reachable
    await expect(page.getByLabel('Nickname')).toBeInViewport();
    const homepage = page.locator('#homepage');
    await homepage.scrollIntoViewIfNeeded();
    await expect(homepage).toBeInViewport({ ratio: 1 });
  });

  test('profile settings dialog keeps its size when switching tabs on mobile', async () => {
    await openProfileSettings(page, 'profile');
    const dialog = page.getByRole('dialog');
    await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.getAnimations().length === 0);
    const first = await dialog.boundingBox();

    for (const tab of ['appearance', 'notifications', 'privacy'] as const) {
      await page.getByTestId(`profile-tab-${tab}`).click();
      expect(await dialog.boundingBox()).toEqual(first);
    }
  });
});

test.describe('Responsive layout on a tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('drawers still work at 768px width', async () => {
    // Sidebars should still be hidden (768 < 1024 lg breakpoint)
    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav).not.toBeVisible();

    // Toggle buttons should be visible
    await expect(page.getByRole('button', { name: /toggle channels/i })).toBeVisible();

    // Open and verify channels drawer
    await page.getByRole('button', { name: /toggle channels/i }).click();
    await expect(channelNav).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Responsive layout on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebars are always visible on desktop', async () => {
    await page.getByRole('button', { name: channel, exact: true }).click();

    // Both sidebars should be visible without toggling
    const channelNav = page.getByTestId('channels-sidebar');
    const usersSidebar = page.getByTestId('users-sidebar');

    await expect(channelNav).toBeVisible({ timeout: 5_000 });
    await expect(usersSidebar).toBeVisible({ timeout: 5_000 });
  });

  test('toggle buttons are hidden on desktop', async () => {
    await expect(page.getByRole('button', { name: /toggle channels/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /toggle users/i })).not.toBeVisible();
  });
});
