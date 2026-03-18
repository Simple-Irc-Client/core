import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let alice: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  alice = await createIrcClient('alice');
  await alice.join('#lobby');
  await alice.setTopic('#lobby', 'Context menu tests');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, 'ctx-tester', { channels: ['#lobby'] });
  await sharedPage.getByRole('button', { name: '#lobby', exact: true }).click();

  const usersSidebar = sharedPage.getByTestId('users-sidebar');
  await expect(usersSidebar.getByText('alice')).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  alice.disconnect();
});

test.describe('User context menu', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens context menu on user click', async () => {
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Click on alice to open context menu
    await usersSidebar.getByRole('button', { name: /alice/ }).click();

    // Context menu should appear with Whois and Priv options
    await expect(sharedPage.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(sharedPage.getByRole('menuitem', { name: 'Priv' })).toBeVisible();
  });

  test('whois shows user info', async () => {
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Open context menu and click Whois
    await usersSidebar.getByRole('button', { name: /alice/ }).click();
    await sharedPage.getByRole('menuitem', { name: 'Whois' }).click();

    // Whois response should appear in the chat log
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText(/alice/)).toBeVisible({ timeout: 10_000 });
  });

  test('priv opens private message tab', async () => {
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Open context menu and click Priv
    await usersSidebar.getByRole('button', { name: /alice/ }).click();
    await sharedPage.getByRole('menuitem', { name: 'Priv' }).click();

    // A private message tab for alice should appear in the sidebar
    const channelNav = sharedPage.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: 'alice' })).toBeVisible({ timeout: 5_000 });
  });

  test('context menu opens on right click', async () => {
    // Navigate back to #lobby (test 3 left us on the alice PM tab)
    await sharedPage.getByRole('button', { name: '#lobby', exact: true }).click();

    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Right-click on alice
    await usersSidebar.getByRole('button', { name: /alice/ }).click({ button: 'right' });

    // Context menu should appear
    await expect(sharedPage.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(sharedPage.getByRole('menuitem', { name: 'Priv' })).toBeVisible();
  });
});
