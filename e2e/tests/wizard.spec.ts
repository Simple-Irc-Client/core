import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';

const ERGO_HOST = 'localhost';
const ERGO_WSS_PORT = '8097';

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
  await page.getByRole('button', { name: 'Next' }).click();
};

let bot: IrcClient;

test.beforeAll(async () => {
  bot = await createIrcClient('wizardbot');
  await bot.join('#welcome');
  await bot.setTopic('#welcome', 'Welcome to the test server!');
});

test.afterAll(() => {
  bot.disconnect();
});

test.describe('Wizard', () => {
  test('completes full wizard flow and reaches main page', async ({ page }) => {
    await page.goto('/');

    // Step 1: Nick
    await expect(page.getByText('Hello')).toBeVisible();
    await expect(page.getByLabel('Enter your nickname')).toBeFocused();

    await page.getByLabel('Enter your nickname').fill('wizard-tester');
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Server
    await expect(page.getByText('Choose your server')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Libera.Chat' })).toBeVisible();

    // Enter custom server
    await page.getByLabel('Server address').fill('localhost');
    await page.getByLabel('Port').clear();
    await page.getByLabel('Port').fill('8097');

    // Connection type selector appears for custom servers
    await expect(page.getByText('Connection Type')).toBeVisible();
    const wsButton = page.getByRole('button', { name: 'WebSocket' });
    await wsButton.click();
    await expect(wsButton).toHaveAttribute('aria-pressed', 'true');

    // Connect
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Loading
    await expect(page.getByText('Connecting to server')).toBeVisible();
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 15_000 });

    // Step 4: Channels list
    await expect(page.getByText('Select a irc channel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('#welcome')).toBeVisible({ timeout: 10_000 });

    // Select and join
    await page.getByRole('row', { name: /welcome/ }).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Next' }).click();

    // Main page
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '#welcome' })).toBeVisible();
  });

  test('saves nick and server settings for reconnecting', async ({ page }) => {
    await page.goto('/');

    // Complete wizard with specific nick
    await page.getByLabel('Enter your nickname').fill('reconnect-tester');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Server address').fill('localhost');
    await page.getByLabel('Port').clear();
    await page.getByLabel('Port').fill('8097');
    await page.getByRole('button', { name: 'WebSocket' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Wait for connection and skip channels
    await expect(page.getByText('Select a irc channel')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Skip' }).click();

    // Main page is now visible
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });

    // Reload the page — wizard should NOT reappear since settings are saved
    await page.reload();

    // Main page should render immediately (isWizardCompleted persisted in localStorage)
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Hello')).not.toBeVisible();

    // Reconnect using saved settings via the user menu
    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: 'Connect' }).click();

    // Should reconnect successfully — sidebar shows "Not connected" status disappears
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Wizard — unhappy paths', () => {
  test('empty nick disables Next button', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Enter your nickname')).toBeVisible();

    // Clear the nick input (it may have a saved value)
    await page.getByLabel('Enter your nickname').clear();

    // Next button should be disabled
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    // Typing a nick enables it
    await page.getByLabel('Enter your nickname').fill('some-nick');
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    // Clearing it again disables it
    await page.getByLabel('Enter your nickname').clear();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  test('nick already in use shows error and Go Back button', async ({ page }) => {
    // Bot is already connected with nick "wizardbot" (from beforeAll)
    await page.goto('/');

    // Use the same nick that the bot already has
    await fillNickStep(page, 'wizardbot');
    await fillServerStepAndConnect(page);

    // Loading step should appear
    await expect(page.getByText('Connecting to server')).toBeVisible();

    // Error message should appear with "Nickname is already in use"
    await expect(page.getByText(/Failed to connect/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Nickname is already in use/i)).toBeVisible();

    // "Go Back" button should be visible
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible();
  });

  test('Go Back from nick-in-use error allows retry with different nick', async ({ page }) => {
    await page.goto('/');

    // Try with taken nick
    await fillNickStep(page, 'wizardbot');
    await fillServerStepAndConnect(page);

    // Wait for error
    await expect(page.getByText(/Failed to connect/)).toBeVisible({ timeout: 15_000 });

    // Click Go Back
    await page.getByRole('button', { name: 'Go Back' }).click();

    // Should return to nick step
    await expect(page.getByLabel('Enter your nickname')).toBeVisible({ timeout: 5_000 });

    // Retry with a different nick
    await fillNickStep(page, 'wizard-retry');
    await fillServerStepAndConnect(page);

    // Should connect successfully this time
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 15_000 });

    // Channels step should appear
    await expect(page.getByText('Select a irc channel')).toBeVisible({ timeout: 15_000 });
  });

  test('wrong server address shows disconnected and Go Back button', async ({ page }) => {
    await page.goto('/');

    await fillNickStep(page, 'wrong-server');

    // Enter a server that doesn't exist
    await page.getByLabel('Server address').fill('localhost');
    await page.getByLabel('Port').clear();
    await page.getByLabel('Port').fill('19999'); // nothing listening here
    await page.getByRole('button', { name: 'WebSocket' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Loading step should appear
    await expect(page.getByText('Connecting to server')).toBeVisible();

    // Should show disconnected/error state since the server doesn't exist
    await expect(page.getByText(/Disconnected|Failed to connect|Something went wrong/)).toBeVisible({ timeout: 30_000 });

    // "Go Back" button should be visible
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible();
  });

  test('Go Back from failed connection returns to nick step', async ({ page }) => {
    await page.goto('/');

    await fillNickStep(page, 'goback-tester');

    // Connect to non-existent server
    await page.getByLabel('Server address').fill('localhost');
    await page.getByLabel('Port').clear();
    await page.getByLabel('Port').fill('19999');
    await page.getByRole('button', { name: 'WebSocket' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Wait for error
    await expect(page.getByText(/Disconnected|Failed to connect|Something went wrong/)).toBeVisible({ timeout: 30_000 });

    // Click Go Back
    await page.getByRole('button', { name: 'Go Back' }).click();

    // Should return to the nick step
    await expect(page.getByLabel('Enter your nickname')).toBeVisible({ timeout: 5_000 });

    // Nick should be preserved
    await expect(page.getByLabel('Enter your nickname')).toHaveValue('goback-tester');
  });
});

test.describe('Wizard — server query param', () => {
  test('known server param shows info banner and skips server step', async ({ page }) => {
    await page.goto('/?server=Libera.Chat');

    // Nick step should show the blue info banner with known server name
    await expect(page.getByText('You will connect to:')).toBeVisible();
    await expect(page.getByText('Libera.Chat')).toBeVisible();

    // Enter a nick and click Next
    await page.getByLabel('Enter your nickname').fill('param-known');
    await page.getByRole('button', { name: 'Next' }).click();

    // Should skip the server step and go directly to loading
    await expect(page.getByText('Connecting to server')).toBeVisible({ timeout: 10_000 });

    // Should NOT see the server selection step
    await expect(page.getByText('Choose your server')).not.toBeVisible();
  });

  test('custom server param shows warning banner and skips server step', async ({ page }) => {
    await page.goto('/?server=irc.example.com');

    // Nick step should show the yellow warning banner with the custom server
    await expect(page.getByText('You will connect to a custom server:')).toBeVisible();
    await expect(page.getByText('irc.example.com')).toBeVisible();

    // Enter a nick and click Next
    await page.getByLabel('Enter your nickname').fill('param-custom');
    await page.getByRole('button', { name: 'Next' }).click();

    // Should skip the server step and go directly to loading
    await expect(page.getByText('Connecting to server')).toBeVisible({ timeout: 10_000 });

    // Should NOT see the server selection step
    await expect(page.getByText('Choose your server')).not.toBeVisible();
  });

  test('custom server param with port is displayed correctly', async ({ page }) => {
    await page.goto('/?server=irc.example.com:6697');

    // Warning banner should show the full server:port
    await expect(page.getByText('You will connect to a custom server:')).toBeVisible();
    await expect(page.getByText('irc.example.com:6697')).toBeVisible();
  });

  test('no server param shows normal wizard without banner', async ({ page }) => {
    await page.goto('/');

    // No server info/warning banner should be visible
    await expect(page.getByText('You will connect to:')).not.toBeVisible();
    await expect(page.getByText('You will connect to a custom server:')).not.toBeVisible();

    // Normal nick step should show
    await expect(page.getByText('Hello')).toBeVisible();
  });
});
