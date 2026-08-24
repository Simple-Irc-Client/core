import { test, expect, type Page } from '@playwright/test';
import { getServerPassword } from '../helpers';

const ERGO_HOST = 'localhost';
const ERGO_WSS_PORT = '8097';

const TEST_NICK = 'pw-forced-rename-tester';
const FORCED_NICK = 'Unidentified-pwtest';
const NICKSERV_PASSWORD = 'CorrectHorseBattery42';

/** Fill in nick step and advance to the server step. */
const fillNickStep = async (page: Page, nick: string): Promise<void> => {
  await page.getByLabel('Enter your nickname').fill(nick);
  await page.getByRole('button', { name: 'Next' }).click();
};

/** Fill in server step with the local ergo WSS server and click Next. */
const fillServerStepAndConnect = async (page: Page): Promise<void> => {
  await page.getByLabel('Server address').fill(ERGO_HOST);
  await page.getByLabel('Port').clear();
  await page.getByLabel('Port').fill(ERGO_WSS_PORT);
  await page.getByRole('button', { name: 'WebSocket' }).click();
  await page.getByLabel('Server password').fill(getServerPassword());
  await page.getByRole('button', { name: 'Next' }).click();
};

/**
 * Flag the current nick as password-protected and jump to the wizard's
 * password step — exactly what kernel.ts's onNotice does once it sees a
 * "This nickname is registered..." NOTICE from NickServ.
 *
 * We can't send that NOTICE for real here: ergo (the test ircd) hardcodes
 * "NickServ" as a reserved/impersonation-protected nickname, so no bot can
 * ever connect as NickServ to send it. Instead we call the exact same store
 * actions the real notice handler calls. Vite's dev server serves unbundled
 * ES modules, so importing this module URL from inside the page resolves to
 * the very same module instance — and the same live Zustand store — the
 * running app is using, not a separate copy.
 */
const triggerPasswordRequired = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    // @ts-expect-error - resolved by Vite's dev server at runtime in the browser page;
    // e2e/ isn't part of the tsc project (tsconfig.json only includes "src"), and there
    // is no real module for tsc to resolve here regardless.
    const settings = await import('/src/features/settings/store/settings.ts');
    settings.setIsPasswordRequired(true);
    settings.setWizardStep('password');
  });

/** Read the encrypted server password saved for the current server out of localStorage. */
const readEncryptedPassword = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('sic-settings');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { state?: { server?: { network?: string }; serverPasswords?: Record<string, { encrypted: string }> } };
    const network = parsed.state?.server?.network;
    return network ? parsed.state?.serverPasswords?.[network]?.encrypted : undefined;
  });

/** Read the live (not-yet-persisted) current nick straight from the running app's store. */
const readCurrentNick = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    // @ts-expect-error - resolved by Vite's dev server at runtime in the browser page;
    // e2e/ isn't part of the tsc project (tsconfig.json only includes "src"), and there
    // is no real module for tsc to resolve here regardless.
    const settings = await import('/src/features/settings/store/settings.ts');
    return settings.getCurrentNick();
  });

test.describe('Wizard password survives a server-forced nick change', () => {
  test('reconnecting after a forced rename + disconnect still finds the saved password', async ({ page }) => {
    test.setTimeout(90_000);

    // --- First connection: get flagged as password-protected, enter + save
    // the password (with "remember" on), finish the wizard. ---
    await page.goto('/');

    await fillNickStep(page, TEST_NICK);
    await fillServerStepAndConnect(page);

    await expect(page.getByText('Connected')).toBeVisible({ timeout: 15_000 });
    await triggerPasswordRequired(page);

    await expect(page.getByText('The selected nickname is password protected')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Password', { exact: true }).fill(NICKSERV_PASSWORD);
    await page.getByRole('switch', { name: 'Remember password' }).click();
    await expect(page.getByRole('switch', { name: 'Remember password' })).toBeChecked();
    await page.getByRole('button', { name: 'Next' }).click();

    // Skip channel selection to finish the wizard.
    await page.getByText('Select a irc channel').waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });

    // The password is encrypted asynchronously (WebCrypto) and only then written
    // to localStorage — wait for it to actually land before moving on, otherwise
    // disconnecting too quickly races the save and makes this test flaky.
    await expect.poll(() => readEncryptedPassword(page), { timeout: 10_000 }).toBeTruthy();

    // --- Simulate the server force-renaming us mid-session, e.g. a NickServ
    // identify-timeout enforcement (":oldnick NICK :newnick", handled identically
    // to a self-issued /nick by kernel.ts's onNick — see commands.spec.ts). ---
    const messageInput = page.locator('#message-input');
    await messageInput.fill(`/nick ${FORCED_NICK}`);
    await messageInput.press('Enter');
    await expect.poll(() => readCurrentNick(page), { timeout: 10_000 }).toBe(FORCED_NICK);

    // --- Disconnect. The wizard's nick field must NOT come back pre-filled with
    // the forced nick — that was the bug: it silently prevented the saved
    // password from ever being matched again. ---
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Disconnect' }).click();

    await expect(page.getByLabel('Enter your nickname')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Enter your nickname')).toHaveValue('');

    // --- Reconnect with the original nick. The server step should already be
    // pre-filled from the persisted server settings. ---
    await fillNickStep(page, TEST_NICK);

    await expect(page.getByLabel('Server address')).toHaveValue(ERGO_HOST);
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Connected')).toBeVisible({ timeout: 15_000 });
    await triggerPasswordRequired(page);

    // The saved password must be found (nick matches) and pre-filled — no
    // "time to enter the password has expired" fallback, and no empty field.
    await expect(page.getByText('The selected nickname is password protected')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/required time to enter the password has expired/)).not.toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(NICKSERV_PASSWORD, { timeout: 10_000 });
    await expect(page.getByRole('switch', { name: 'Remember password' })).toBeChecked();
  });
});
