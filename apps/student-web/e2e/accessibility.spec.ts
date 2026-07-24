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
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('course Inspect view has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/?course=TDT4136');
  await expect(page.getByRole('article', { name: 'TDT4136 course details' })).toBeVisible();
  await expectNoAxeViolations(page);
});
