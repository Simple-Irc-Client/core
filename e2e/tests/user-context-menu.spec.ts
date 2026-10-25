import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, testTag } from '../helpers';

let alice: IrcClient;
let page: Page;
let tag: string;

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  alice = await createIrcClient(`ctx-alice-${tag}`);
  await alice.join(`#lobby-${tag}`);
  await alice.setTopic(`#lobby-${tag}`, 'Context menu tests');
  // The wizard's channel picker only lists channels that already exist on the
  // server, so this needs a member before ctx-tester can join it below.
  await alice.join(`#invite-target-${tag}`);

  await page.goto('/');
  // The second channel gives the "Invite to Channel" submenu something to
  // list, without requiring ctx-tester to hold any operator flag.
  await connectViaWizard(page, `ctx-tester-${tag}`, { channels: [`#lobby-${tag}`, `#invite-target-${tag}`] });
  await page.getByRole('button', { name: `#lobby-${tag}`, exact: true }).click();

  const usersSidebar = page.getByTestId('users-sidebar');
  await expect(usersSidebar.getByText(alice.nick)).toBeVisible({ timeout: 10_000 });
});

test.afterEach(() => {
  alice.disconnect();
});

test.describe('User context menu', () => {
  test('opens context menu on user click', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Click on alice to open context menu
    await usersSidebar.getByRole('button', { name: alice.nick }).click();

    // Context menu should appear with Whois and Priv options
    await expect(page.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Priv' })).toBeVisible();
  });

  test('whois shows user info', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Open context menu and click Whois
    await usersSidebar.getByRole('button', { name: alice.nick }).click();
    await page.getByRole('menuitem', { name: 'Whois' }).click();

    // Whois response should appear in the chat log
    const chatLog = page.getByTestId('chat-log');
    await expect(chatLog.getByText(alice.nick).first()).toBeVisible({ timeout: 10_000 });
  });

  test('priv opens private message tab', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Open context menu and click Priv
    await usersSidebar.getByRole('button', { name: alice.nick }).click();
    await page.getByRole('menuitem', { name: 'Priv' }).click();

    // A private message tab for alice should appear in the sidebar
    const channelNav = page.getByTestId('channels-sidebar');
    await expect(channelNav.getByRole('button', { name: alice.nick })).toBeVisible({ timeout: 5_000 });
  });

  test('context menu opens on right click', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Right-click on alice
    await usersSidebar.getByRole('button', { name: alice.nick }).click({ button: 'right' });

    // Context menu should appear
    await expect(page.getByRole('menuitem', { name: 'Whois' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Priv' })).toBeVisible();
  });

  test('right-clicking inside an open submenu does not fall through to the native context menu', async () => {
    const usersSidebar = page.getByTestId('users-sidebar');

    // Open the menu and its "Invite to Channel" submenu.
    await usersSidebar.getByRole('button', { name: alice.nick }).click();
    const inviteTrigger = page.getByRole('menuitem', { name: 'Invite to Channel' });
    await inviteTrigger.hover();
    await expect(page.getByRole('menuitem', { name: `#invite-target-${tag}` })).toBeVisible();

    // Arm a one-shot listener before the click so we observe the *next*
    // contextmenu event's defaultPrevented state once it has finished
    // bubbling (a capturing-phase listener would fire before any ancestor
    // gets a chance to call preventDefault, always reading false). A stray
    // right-click landing back on the app's own (already open) menu must
    // still be swallowed — it must never fall through to the native
    // OS/WebView context menu.
    const preventedPromise = page.evaluate(() => new Promise<boolean>((resolve) => {
      document.addEventListener('contextmenu', (e) => resolve(e.defaultPrevented), { once: true });
    }));
    await inviteTrigger.click({ button: 'right' });
    expect(await preventedPromise).toBe(true);
  });
});
