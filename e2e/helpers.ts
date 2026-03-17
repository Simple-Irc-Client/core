import { type Page } from '@playwright/test';

const ERGO_HOST = 'localhost';
// Port 6697 is blocked by Chrome (ERR_UNSAFE_PORT); use 8097 instead
const ERGO_WSS_PORT = '8097';

/**
 * Go through the wizard to connect to the local ergo server.
 * Enters nick, custom server (localhost WebSocket), skips password,
 * and either joins specified channels or skips the channel step.
 */
export const connectViaWizard = async (
  page: Page,
  nick: string,
  options: { channels?: string[] } = {},
): Promise<void> => {
  // Step 1: Nick
  await page.getByLabel('Enter your nickname').fill(nick);
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2: Server - enter custom WebSocket server
  await page.getByLabel('Server address').fill(ERGO_HOST);
  await page.getByLabel('Port').clear();
  await page.getByLabel('Port').fill(ERGO_WSS_PORT);

  // Select WebSocket connection type
  await page.getByRole('button', { name: 'WebSocket' }).click();

  // Submit (this triggers connection + goes to loading step)
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: Loading - wait for connection and password check (≈5 seconds)
  await page.getByText('Connected').waitFor({ timeout: 15_000 });

  // Wait for the channels step to appear (after ~5s password check)
  await page.getByText('Select a irc channel').waitFor({ timeout: 15_000 });

  // Step 4: Channels - join or skip
  if (options.channels && options.channels.length > 0) {
    // Wait for channel list to finish loading
    await page.getByText('Downloading channels list').waitFor({ state: 'hidden', timeout: 15_000 });

    // Select each channel
    for (const channel of options.channels) {
      await page.getByRole('row', { name: new RegExp(channel.replace('#', '')) }).getByRole('checkbox').check();
    }
    await page.getByRole('button', { name: 'Next' }).click();
  } else {
    await page.getByRole('button', { name: 'Skip' }).click();
  }

  // Wait for main page to render
  await page.locator('#message-input').waitFor({ timeout: 10_000 });
};
