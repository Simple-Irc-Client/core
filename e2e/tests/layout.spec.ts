import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard, testTag } from '../helpers';

let page: Page;
let tag: string;

const panelWidth = (testId: string): Promise<number> => page.getByTestId(testId).evaluate((panel) => panel.getBoundingClientRect().width);

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page: testPage }, testInfo) => {
  page = testPage;
  tag = testTag(testInfo);

  await page.goto('/');
  await connectViaWizard(page, `layout-user-${tag}`);
});

test.describe('Layout', () => {
  test('the emoji picker follows dark mode', async () => {
    /** The picker's own background, as a 0 (black) to 255 (white) brightness */
    const pickerBrightness = async (): Promise<number> => {
      await page.getByRole('button', { name: /emoticons/i }).click();
      const picker = page.locator('.epr-main');
      await expect(picker).toBeVisible();
      const [r = 0, g = 0, b = 0] = (await picker.evaluate((element) => getComputedStyle(element).backgroundColor)).match(/\d+/g)?.map(Number) ?? [];
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      return (r + g + b) / 3;
    };
    const setDark = async (dark: boolean): Promise<void> => {
      if (await page.locator('html').evaluate((element) => element.classList.contains('dark')) !== dark) {
        await page.locator('[data-avatar-button]').click();
        await page.getByRole('menuitem', { name: dark ? 'Dark Mode' : 'Light Mode' }).click();
      }
    };

    await setDark(true);
    expect(await pickerBrightness()).toBeLessThan(80);
    await setDark(false);
    expect(await pickerBrightness()).toBeGreaterThan(200);
  });

  test('dark mode is switched from the user menu, and kept after a reload', async () => {
    const html = page.locator('html');
    const wasDark = await html.evaluate((element) => element.classList.contains('dark'));

    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: wasDark ? 'Light Mode' : 'Dark Mode' }).click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);

    await page.reload();
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
  });

  test('the channels panel widens by dragging its edge, and by the arrow keys', async () => {
    await expect(page.locator('#message-input')).toBeVisible({ timeout: 15_000 });
    const handle = page.getByRole('separator', { name: 'Resize channels panel' });
    const before = await panelWidth('channels-sidebar');

    const box = await handle.boundingBox();
    if (box === null) { throw new Error('the resize handle is not shown'); }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => panelWidth('channels-sidebar')).toBeCloseTo(before + 60, 0);

    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => panelWidth('channels-sidebar')).toBeCloseTo(before + 70, 0);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => panelWidth('channels-sidebar')).toBeCloseTo(before + 60, 0);
  });

  test('the users panel widens by dragging its edge the other way, and never gets narrower than it starts', async () => {
    // The users panel is a channel's
    const input = page.locator('#message-input');
    await input.fill(`/join #layout-${tag}`);
    await input.press('Enter');
    await expect(page.getByTestId('users-sidebar')).toBeVisible({ timeout: 10_000 });
    const handle = page.getByRole('separator', { name: 'Resize users panel' });
    const before = await panelWidth('users-sidebar');

    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => panelWidth('users-sidebar')).toBeCloseTo(before + 10, 0);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => panelWidth('users-sidebar')).toBeCloseTo(before, 0);
  });
});
