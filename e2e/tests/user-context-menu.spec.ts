import { test, expect } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let alice: IrcClient;

test.beforeAll(async () => {
  alice = await createIrcClient('alice');
  await alice.join('#lobby');
  await alice.setTopic('#lobby', 'Context menu tests');
});

test.afterAll(() => {
  alice.disconnect();
});

test.describe('User context menu', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens context menu on user click', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'ctx-tester', { channels: ['#lobby'] });

    await page.getByRole('button', { name: '#lobby' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });

    // Click on alice to open context menu
    await usersSidebar.getByRole('button', { name: /alice/ }).click();

    // Context menu should appear with Whois and Priv options
    await expect(page.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Priv' })).toBeVisible();
  });

  test('whois shows user info', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'whois-tester', { channels: ['#lobby'] });

    await page.getByRole('button', { name: '#lobby' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });

    // Open context menu and click Whois
    await usersSidebar.getByRole('button', { name: /alice/ }).click();
    await page.getByRole('menuitem', { name: 'Whois' }).click();

    // Whois response should appear in the chat log
    const chatLog = page.getByRole('log');
    await expect(chatLog.getByText(/alice/)).toBeVisible({ timeout: 10_000 });
  });

  test('priv opens private message tab', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'priv-tester', { channels: ['#lobby'] });

    await page.getByRole('button', { name: '#lobby' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });

    // Open context menu and click Priv
    await usersSidebar.getByRole('button', { name: /alice/ }).click();
    await page.getByRole('menuitem', { name: 'Priv' }).click();

    // A private message tab for alice should appear in the sidebar
    const channelNav = page.getByRole('navigation', { name: 'Channels' });
    await expect(channelNav.getByRole('button', { name: 'alice' })).toBeVisible({ timeout: 5_000 });
  });

  test('context menu opens on right click', async ({ page }) => {
    await page.goto('/');
    await connectViaWizard(page, 'rclick-tester', { channels: ['#lobby'] });

    await page.getByRole('button', { name: '#lobby' }).click();

    const usersSidebar = page.getByRole('complementary', { name: 'Users' });
    await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });

    // Right-click on alice
    await usersSidebar.getByRole('button', { name: /alice/ }).click({ button: 'right' });

    // Context menu should appear
    await expect(page.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Priv' })).toBeVisible();
  });
});
