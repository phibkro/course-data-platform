import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const expectNoAxeViolations = async (page: Page): Promise<void> => {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }));

  expect(summary, 'axe found accessibility violations').toEqual([]);
};

const waitForEnrichedCatalogue = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Course results' })).toBeVisible();
  await expect(page.getByText('Assessment & work', { exact: true })).toBeVisible();
  await expect(page.getByText('Historical outcomes', { exact: true })).toBeVisible();
};

test('loaded Explore catalogue has no detectable WCAG A/AA violations', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await expectNoAxeViolations(page);
});

test('open Refine dialog has no detectable WCAG A/AA violations', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Refine' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close course refinements' })).toBeFocused();
  await expect(dialog.getByLabel('Search courses')).not.toBeFocused();
  await expectNoAxeViolations(page);
});

test('custom course filter listbox has no detectable WCAG A/AA violations', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Campus' }).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option', { name: 'All campuses' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expectNoAxeViolations(page);
});

test('Refine listboxes remain interactive above the dialog', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Refine' }).click();
  const dialog = page.getByRole('dialog');
  const term = dialog.getByRole('button', { name: 'Term' });

  await term.click();
  await page.getByRole('option', { name: 'Spring 2027 · 2026/27' }).click();

  await expect(term).toContainText('Spring 2027');
});

test('Theme Lab has no detectable WCAG A/AA violations', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Open appearance settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(page).toHaveURL(/\/appearance(?:\?|$)/);
  await expect(dialog.getByRole('heading', { name: 'Theme lab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close appearance settings' })).toBeFocused();
  await expectNoAxeViolations(page);

  await page.goBack();
  await expect(page).not.toHaveURL(/\/appearance(?:\?|$)/);
  await expect(dialog).not.toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/appearance(?:\?|$)/);
  await expect(dialog).toBeVisible();

  await page.getByRole('button', { name: 'Close appearance settings' }).click();
  await expect(page).not.toHaveURL(/\/appearance(?:\?|$)/);
});

test('course Inspect view has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/?course=TDT4136');
  await expect(page.getByRole('article', { name: 'TDT4136 course details' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('desktop sidebar collapse preference survives reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await waitForEnrichedCatalogue(page);

  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('course-lens:sidebar-collapsed')))
    .toBe('1');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
});

test('theme preference applies immediately and survives reload', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Open appearance settings' }).click();
  await page.getByRole('button', { name: /Pine/ }).click();
  await page.getByRole('button', { name: 'Dark' }).click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        theme: document.documentElement.dataset.themeColor,
        mode: document.documentElement.dataset.colorMode,
        dark: document.documentElement.classList.contains('dark'),
      })),
    )
    .toEqual({ theme: 'emerald', mode: 'dark', dark: true });

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.themeColor))
    .toBe('emerald');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
    .toBe(true);
});

test('a saved course survives reload and the List has no detectable WCAG A/AA violations', async ({
  page,
}) => {
  await waitForEnrichedCatalogue(page);

  await page.getByRole('button', { name: 'Save TDT4136 to List' }).click();
  await expect(page.getByRole('button', { name: 'Remove TDT4136 from List' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('course-lens:list')))
    .toContain('TDT4136');

  await page.getByRole('link', { name: 'List' }).click();
  await expect(page).toHaveURL(/\/list(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Your saved courses' })).toBeVisible();
  await expect(page.getByText('1 saved course', { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel('Your note').fill('Ask the adviser about the project');
  await page.getByRole('button', { name: 'Save note' }).click();

  await page.reload();
  await expect(page.getByLabel('Your note')).toHaveValue('Ask the adviser about the project');

  await page.getByRole('button', { name: 'Remove TDT4136 from List' }).click();
  await expect(page.getByText('You have not saved a course yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('You have not saved a course yet')).toBeVisible();
});

test('an unreadable saved list is reported and kept until the student resets it', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('course-lens:list', '{not json'));

  await page.goto('/list');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Saved courses could not be loaded');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('course-lens:list')))
    .toBe('{not json');
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Reset saved courses' }).click();
  await expect(page.getByText('You have not saved a course yet')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('course-lens:list')))
    .toContain('"savedCourses":[]');
});

test('an unreadable saved list pauses Save on Explore with a path to recover it, not "still loading"', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('course-lens:list', '{not json'));

  await waitForEnrichedCatalogue(page);

  const saveButton = page.getByRole('button', { name: 'Save TDT4136 to List' });
  await expect(saveButton).toBeDisabled();
  await expect(saveButton).toHaveAttribute(
    'title',
    'Saving is paused until the stored list is recovered or reset.',
  );

  const recoveryLink = page.getByRole('link', { name: 'Open List to recover saved courses' });
  await expect(recoveryLink).toBeVisible();
  await expectNoAxeViolations(page);

  await recoveryLink.click();
  await expect(page).toHaveURL(/\/list(?:\?|$)/);
  await expect(page.getByRole('alert')).toContainText('Saved courses could not be loaded');

  await page.getByRole('button', { name: 'Reset saved courses' }).click();
  await expect(page.getByText('You have not saved a course yet')).toBeVisible();
});
