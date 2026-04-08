import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { connectViaWizard } from '../helpers';

let sharedPage: Page;
let sharedContext: BrowserContext;
let isChromium: boolean;

test.beforeAll(async ({ browser }) => {
  isChromium = browser.browserType().name() === 'chromium';
  const nick = isChromium ? 'ctx-chrome' : 'ctx-firefox';
  sharedContext = await browser.newContext({
    ...(isChromium ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
    ignoreHTTPSErrors: true,
  });
  sharedPage = await sharedContext.newPage();
  await sharedPage.goto('/');
  await connectViaWizard(sharedPage, nick);
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Input context menu', () => {
  test.describe.configure({ mode: 'serial' });

  const messageInput = () => sharedPage.locator('#message-input');

  const openContextMenu = async () => {
    await messageInput().click({ button: 'right' });
    await expect(sharedPage.getByRole('menuitem', { name: 'Paste' })).toBeVisible();
  };

  test('opens context menu on right-click', async () => {
    await openContextMenu();

    await expect(sharedPage.getByRole('menuitem', { name: 'Cut' })).toBeVisible();
    await expect(sharedPage.getByRole('menuitem', { name: 'Copy' })).toBeVisible();
    await expect(sharedPage.getByRole('menuitem', { name: 'Paste' })).toBeVisible();
    await expect(sharedPage.getByRole('menuitem', { name: 'Select All' })).toBeVisible();

    await sharedPage.keyboard.press('Escape');
  });

  test('copy and paste via context menu', async () => {
    const input = messageInput();
    await input.fill('clipboard test');
    // Select all text
    await input.selectText();

    // Copy via context menu
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Copy' }).click();

    // Clear input and paste
    await input.fill('');
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Paste' }).click();

    await expect(input).toHaveValue('clipboard test', { timeout: 3_000 });
  });

  test('cut removes text and allows paste', async () => {
    const input = messageInput();
    await input.fill('cut me');
    await input.selectText();

    // Cut via context menu
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Cut' }).click();

    // Input should be empty after cut
    await expect(input).toHaveValue('', { timeout: 3_000 });

    // Paste the cut text back
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Paste' }).click();

    await expect(input).toHaveValue('cut me', { timeout: 3_000 });
  });

  test('paste text copied from a different page', async () => {
    const input = messageInput();
    await input.fill('');

    // Simulate the user leaving the app (clears internal clipboard buffer so
    // stale in-app copies don't shadow external clipboard content)
    await sharedPage.evaluate(() => globalThis.dispatchEvent(new Event('blur')));

    // Open a separate page in the same context and copy text there
    // (simulates copying from a different site — shared clipboard, different origin)
    const externalPage = await sharedContext.newPage();
    await externalPage.setContent('<textarea id="ext">copied from outside</textarea>');
    const textarea = externalPage.locator('#ext');
    await textarea.focus();
    await textarea.selectText();
    await externalPage.keyboard.press('ControlOrMeta+c');
    await externalPage.close();

    // Switch back to the app and paste via our context menu
    await sharedPage.bringToFront();
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Paste' }).click();

    if (isChromium) {
      // Chromium grants clipboard-read permission — readText() works directly
      await expect(input).toHaveValue('copied from outside', { timeout: 3_000 });
    } else {
      // Firefox can't read external clipboard — shows keyboard shortcut hint
      await expect(sharedPage.getByRole('alert')).toContainText(/Ctrl\+V/, { timeout: 3_000 });
      await expect(input).toHaveValue('');
    }
  });

  test('select all via context menu', async () => {
    const input = messageInput();
    await input.fill('select all test');

    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Select All' }).click();

    // After select all, the entire text should be selected — verify by copying
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Copy' }).click();

    await input.fill('');
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Paste' }).click();

    await expect(input).toHaveValue('select all test', { timeout: 3_000 });
  });

  test('disabled items when no selection', async () => {
    const input = messageInput();
    await input.fill('some text');
    // Click at end to deselect
    await input.click();

    await openContextMenu();

    // Cut and Copy should be disabled (no selection)
    await expect(sharedPage.getByRole('menuitem', { name: 'Cut' })).toHaveAttribute('aria-disabled', 'true');
    await expect(sharedPage.getByRole('menuitem', { name: 'Copy' })).toHaveAttribute('aria-disabled', 'true');

    // Paste should be enabled
    await expect(sharedPage.getByRole('menuitem', { name: 'Paste' })).not.toHaveAttribute('aria-disabled');

    await sharedPage.keyboard.press('Escape');
  });

  test('paste replaces selected text', async () => {
    const input = messageInput();

    // Copy "new text" via our context menu (populates internal buffer)
    await input.fill('new text');
    await input.selectText();
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Copy' }).click();

    // Now fill with different text, select it, and paste over it
    await input.fill('replace me');
    await input.selectText();
    await openContextMenu();
    await sharedPage.getByRole('menuitem', { name: 'Paste' }).click();

    await expect(input).toHaveValue('new text', { timeout: 3_000 });
  });
});
