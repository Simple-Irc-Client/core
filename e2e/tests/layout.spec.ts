import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard } from '../helpers';

let page: Page;

const panelWidth = (testId: string): Promise<number> => page.getByTestId(testId).evaluate((panel) => panel.getBoundingClientRect().width);

test.beforeAll(async ({ browser }, testInfo) => {
  // Each browser project runs this at once on the same server: a nick of its own keeps them apart
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';

  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('/');
  await connectViaWizard(page, `layout-user-${tag}`);
});

test.afterAll(async () => {
  await page?.close();
});

test.describe('Layout', () => {
  test.describe.configure({ mode: 'serial' });

  test('dark mode is switched from the user menu, and kept after a reload', async () => {
    const html = page.locator('html');
    const wasDark = await html.evaluate((element) => element.classList.contains('dark'));

    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: wasDark ? 'Light Mode' : 'Dark Mode' }).click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);

    await page.reload();
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);

    await page.locator('[data-avatar-button]').click();
    await page.getByRole('menuitem', { name: wasDark ? 'Dark Mode' : 'Light Mode' }).click();
    await expect(html).toHaveClass(wasDark ? /\bdark\b/ : /^(?!.*\bdark\b)/);
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
