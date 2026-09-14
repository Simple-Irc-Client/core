import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let alice: IrcClient;
let sharedPage: Page;

test.beforeAll(async ({ browser }) => {
  alice = await createIrcClient('alice');
  await alice.join('#lobby');
  await alice.setTopic('#lobby', 'Context menu tests');
  // The wizard's channel picker only lists channels that already exist on the
  // server, so this needs a member before ctx-tester can join it below.
  await alice.join('#invite-target');

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  // The second channel gives the "Invite to Channel" submenu something to
  // list, without requiring ctx-tester to hold any operator flag.
  await connectViaWizard(sharedPage, 'ctx-tester', { channels: ['#lobby', '#invite-target'] });
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

    // Close the context menu so it doesn't interfere with subsequent tests
    await sharedPage.keyboard.press('Escape');
    await expect(sharedPage.getByRole('menuitem', { name: 'Whois' })).not.toBeVisible({ timeout: 3_000 });
  });

  test('whois shows user info', async () => {
    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Open context menu and click Whois
    await usersSidebar.getByRole('button', { name: /alice/ }).click();
    await sharedPage.getByRole('menuitem', { name: 'Whois' }).click();

    // Whois response should appear in the chat log
    const chatLog = sharedPage.getByTestId('chat-log');
    await expect(chatLog.getByText(/alice/).first()).toBeVisible({ timeout: 10_000 });
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

  test('right-clicking inside an open submenu does not fall through to the native context menu', async () => {
    // The previous test leaves its menu open — close it first so it doesn't
    // cover the users sidebar and block the click below.
    await sharedPage.keyboard.press('Escape');
    await expect(sharedPage.getByRole('menuitem', { name: 'Whois' })).not.toBeVisible({ timeout: 3_000 });

    const usersSidebar = sharedPage.getByTestId('users-sidebar');

    // Open the menu and its "Invite to Channel" submenu.
    await usersSidebar.getByRole('button', { name: /alice/ }).click();
    const inviteTrigger = sharedPage.getByRole('menuitem', { name: 'Invite to Channel' });
    await inviteTrigger.hover();
    await expect(sharedPage.getByRole('menuitem', { name: '#invite-target' })).toBeVisible();

    // Arm a one-shot listener before the click so we observe the *next*
    // contextmenu event's defaultPrevented state once it has finished
    // bubbling (a capturing-phase listener would fire before any ancestor
    // gets a chance to call preventDefault, always reading false). A stray
    // right-click landing back on the app's own (already open) menu must
    // still be swallowed — it must never fall through to the native
    // OS/WebView context menu.
    const preventedPromise = sharedPage.evaluate(() => new Promise<boolean>((resolve) => {
      document.addEventListener('contextmenu', (e) => resolve(e.defaultPrevented), { once: true });
    }));
    await inviteTrigger.click({ button: 'right' });
    expect(await preventedPromise).toBe(true);

    await sharedPage.keyboard.press('Escape');
  });
});
