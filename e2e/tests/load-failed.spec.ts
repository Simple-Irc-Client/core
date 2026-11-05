import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard, testTag } from '../helpers';

// The dev server serves each lazily imported module as its own request: source files as is, dependencies pre-bundled
const WIZARD_PAGE_MODULE = /\/src\/features\/wizard\/pages\/WizardPage\.tsx/;
const EMOJI_PICKER_MODULE = /\/node_modules\/\.vite\/deps\/emoji-picker-react\.js/;

const LOAD_FAILED_MESSAGE = 'Something went wrong while loading. Reload the page to try again.';

const failToLoad = async (page: Page, module: RegExp): Promise<void> => {
  await page.route(module, (route) => route.abort('failed'));
};

test.describe('Lazily loaded parts that fail to load', () => {
  test('a wizard that fails to load offers a reload that brings it back', async ({ page }) => {
    await failToLoad(page, WIZARD_PAGE_MODULE);
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText(LOAD_FAILED_MESSAGE);

    await page.unroute(WIZARD_PAGE_MODULE);
    await page.getByRole('button', { name: 'Reload' }).click();

    await expect(page.getByLabel('Enter your nickname')).toBeVisible();
  });

  test('an emoji picker that fails to load leaves the chat usable', async ({ page }, testInfo) => {
    await page.goto('/');
    await connectViaWizard(page, `loadfail-${testTag(testInfo)}`);
    await failToLoad(page, EMOJI_PICKER_MODULE);

    await page.getByRole('button', { name: 'Emoticons' }).click();

    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(LOAD_FAILED_MESSAGE);
    await expect(page.locator('#message-input')).toBeVisible();
  });
});
