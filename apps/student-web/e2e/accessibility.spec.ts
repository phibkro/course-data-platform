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
