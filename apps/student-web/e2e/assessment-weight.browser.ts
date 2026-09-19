import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Inspect retains forms and explains rejected weights through real HTTP', async ({ page }) => {
  await page.goto('/');
  const course = page.getByRole('link', {
    name: 'Open TDT4136: Introduction to Artificial Intelligence',
  });
  await course.focus();
  await course.press('Enter');
  const detail = page.getByRole('article', { name: 'TDT4136 course details' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Project', { exact: true })).toBeVisible();
  await expect(detail.getByText('Oral Exam', { exact: true })).toBeVisible();
  await expect(
    detail.getByText(
      /Grade weight: Unknown\. Structured ordinary assessment weights total 120%, not 100%\./,
    ),
  ).toHaveCount(2);
  await expect(detail.getByText(/ · 60%/)).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
