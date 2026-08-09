import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard } from '../helpers';

let bot: IrcClient;
let sharedPage: Page;
let channel: string;

const SCRIPT_SOURCE = `sic.command('marco', (args, channel) => { sic.say(channel, 'polo ' + args); });
sic.on('message', (e) => { if (e.text.includes('classified')) e.block(); });
sic.on('message', (e) => { e.text = e.text.replace('grape', 'banana'); });
`;

test.beforeAll(async ({ browser }, testInfo) => {
  const suffix = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#scripts-${suffix}`;
  bot = await createIrcClient(`scriptbot-${suffix}`);
  await bot.join(channel);

  sharedPage = await browser.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, `scripts-user-${suffix}`, { channels: [channel] });
  await sharedPage.getByRole('button', { name: channel, exact: true }).click();
  await expect(sharedPage.locator('#message-input')).toBeEnabled({ timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedPage.close();
  bot.disconnect();
});

test.describe('User scripts', () => {
  test.describe.configure({ mode: 'serial' });

  test('creates and enables a script via settings', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible();

    await sharedPage.getByTestId('script-new').click();
    await sharedPage.getByTestId('script-name').fill('e2e script');

    // Replace the template in the CodeMirror editor
    const editor = sharedPage.getByTestId('script-source-editor').locator('.cm-content');
    await editor.click();
    await sharedPage.keyboard.press('ControlOrMeta+a');
    await sharedPage.keyboard.press('Delete');
    await editor.fill(SCRIPT_SOURCE);
    await sharedPage.getByTestId('script-save').click();

    // Enable it — this lazily loads the QuickJS engine
    await expect(sharedPage.getByTestId('script-toggle')).toBeVisible();
    await sharedPage.getByTestId('script-toggle').click();
    await expect(sharedPage.getByTestId('script-toggle')).toBeChecked();
    // No load error surfaced
    await expect(sharedPage.getByTestId('script-error')).toHaveCount(0);

    await sharedPage.keyboard.press('Escape');
  });

  test('script-registered /command sends to the channel', async () => {
    const input = sharedPage.locator('#message-input');

    // Script activation is async (lazy engine load); the command entering
    // Tab-completion is the observable "script is live" signal
    await expect(async () => {
      await input.fill('');
      await input.pressSequentially('/marc');
      await input.press('Tab');
      await expect(input).toHaveValue('/marco ', { timeout: 500 });
    }).toPass({ timeout: 15_000 });

    await input.fill('/marco 42');
    await input.press('Enter');

    // With echo-message active the rendered line proves the PRIVMSG made the
    // full round-trip through the server
    await expect(sharedPage.getByTestId('chat-log').getByText('polo 42')).toBeVisible({ timeout: 10_000 });
  });

  test('script blocks matching incoming messages', async () => {
    bot.sendMessage(channel, 'this is classified stuff');
    bot.sendMessage(channel, 'this is public stuff');

    await expect(sharedPage.getByText('this is public stuff')).toBeVisible({ timeout: 10_000 });
    await expect(sharedPage.getByText('this is classified stuff')).toHaveCount(0);
  });

  test('script rewrites incoming message text', async () => {
    bot.sendMessage(channel, 'I like grape juice');

    await expect(sharedPage.getByText('I like banana juice')).toBeVisible({ timeout: 10_000 });
    await expect(sharedPage.getByText('I like grape juice')).toHaveCount(0);
  });

  test('disabled script stops filtering', async () => {
    await sharedPage.locator('[data-avatar-button]').click();
    await sharedPage.getByRole('menuitem', { name: 'Profile Settings' }).click();
    await sharedPage.getByTestId('script-toggle').click();
    await expect(sharedPage.getByTestId('script-toggle')).not.toBeChecked();
    await sharedPage.keyboard.press('Escape');

    bot.sendMessage(channel, 'now classified is fine');
    await expect(sharedPage.getByText('now classified is fine')).toBeVisible({ timeout: 10_000 });
  });
});
