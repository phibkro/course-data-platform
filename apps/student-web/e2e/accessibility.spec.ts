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
  // The catalogue lists every fixture course, so these headings repeat per
  // card. Waiting on the first is what "enrichment has arrived" means.
  await expect(page.getByText('Assessment & work', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Historical outcomes', { exact: true }).first()).toBeVisible();
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
  await page.getByRole('option', { name: 'Spring 2027' }).click();

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

  await page.getByRole('link', { name: 'Saved' }).click();
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

  // Every card offers the way out, not just the one the student happened to
  // reach for; the recovery path belongs to the broken list, not to a course.
  const recoveryLinks = page.getByRole('link', { name: 'Open List to recover saved courses' });
  await expect(recoveryLinks.first()).toBeVisible();
  await expectNoAxeViolations(page);

  await recoveryLinks.first().click();
  await expect(page).toHaveURL(/\/list(?:\?|$)/);
  await expect(page.getByRole('alert')).toContainText('Saved courses could not be loaded');

  await page.getByRole('button', { name: 'Reset saved courses' }).click();
  await expect(page.getByText('You have not saved a course yet')).toBeVisible();
});

test('labels compose collections, stay in the URL, and survive history and reload', async ({
  page,
}) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Save TDT4136 to List' }).click();
  await page.getByRole('link', { name: 'Saved' }).click();
  await expect(page.getByRole('heading', { name: 'Your saved courses' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit labels for TDT4136' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The Dialog primitive owns focus, so the close control is focused on open.
  await expect(page.getByRole('button', { name: 'Close labels' })).toBeFocused();

  await dialog.getByLabel('Label name').fill('Autumn 2027');
  // The colour choice is a radio group: it owns roving focus and arrow keys.
  await dialog.getByRole('radio', { name: 'Sky' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Violet' })).toBeChecked();

  // Browsing colours is draft state. The swatches sit inside the label form, so
  // a real click must not submit it: nothing is created, renamed, or attached
  // until Apply, and the draft name is still there to Apply with.
  await dialog.getByRole('radio', { name: 'Emerald' }).click();
  await expect(dialog.getByRole('radio', { name: 'Emerald' })).toBeChecked();
  await expect(dialog.getByText('You have not created a label yet.')).toBeVisible();
  await expect(dialog.getByLabel('Label name')).toHaveValue('Autumn 2027');
  await expect(dialog.getByRole('alert')).toBeHidden();

  await dialog.getByRole('button', { name: 'Add label' }).click();
  await expect(dialog.getByRole('checkbox', { name: /Autumn 2027/ })).toBeChecked();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Close labels' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^Autumn 2027/ })).toBeVisible();

  await page.getByRole('button', { name: /^Autumn 2027/ }).click();
  await expect(page).toHaveURL(/labels=label-/);
  await expect(page.getByText('Showing 1 of 1 saved courses')).toBeVisible();
  await expect(page.getByText('Showing saved courses in Autumn 2027.')).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goBack();
  await expect(page).not.toHaveURL(/labels=label-/);
  await expect(page.getByText('1 saved course', { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/labels=label-/);
  // The URL updates before the SPA's popstate handler re-renders: wait for
  // the restored filter to actually land in the model/UI, not just the
  // address bar, before driving the next interaction.
  await expect(page.getByText('Showing saved courses in Autumn 2027.')).toBeVisible();

  await page.getByRole('button', { name: 'Combine labels' }).click();
  // The disclosure panel is `inert` while collapsed and its click resolving
  // does not guarantee the open-state re-render has landed. Wait for
  // aria-expanded to flip before acting on its now-actionable contents;
  // clicking through a still-inert panel silently drops the event.
  await expect(page.getByRole('button', { name: 'Combine labels' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByLabel('Exclude Autumn 2027').click();
  await expect(page).toHaveURL(/notLabels=label-/);
  await expect(page.getByText('No saved courses match this label combination')).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();

  await page.getByRole('button', { name: 'Clear label filter' }).first().click();
  await expect(page).not.toHaveURL(/labels=|notLabels=/);
  await expect(page.getByText('1 saved course', { exact: true })).toBeVisible();

  // Unlabeled is derived from membership: the only saved course carries the new
  // label, so the derived collection is empty and says so as a filter outcome.
  await page.getByRole('button', { name: /^Unlabeled/ }).click();
  await expect(page).toHaveURL(/unlabeled=1/);
  await expect(page.getByText('Showing saved courses in Unlabeled.')).toBeVisible();
  await expect(page.getByText('No saved courses match this label combination')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Clear label filter' }).first().click();
  await expect(page).not.toHaveURL(/unlabeled=/);

  // Repeated row actions read the same in every row; the row's action group and
  // each button's description carry which label they act on.
  await page.getByRole('button', { name: 'Edit labels for TDT4136' }).click();
  const actions = page.getByRole('group', { name: 'Actions for Autumn 2027' });
  await expect(actions.getByRole('button', { name: 'Edit label' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Delete label' })).toBeVisible();

  // Escape belongs to the Dialog primitive and discards the draft with it.
  await dialog.getByLabel('Label name').fill('Draft that is thrown away');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Edit labels for TDT4136' }).click();
  await expect(dialog.getByLabel('Label name')).toHaveValue('');

  await page.getByRole('button', { name: 'Close labels' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Autumn 2027/ })).toBeVisible();
});

test('selecting saved courses offers labelling as the one bulk action', async ({ page }) => {
  await waitForEnrichedCatalogue(page);
  await page.getByRole('button', { name: 'Save TDT4136 to List' }).click();
  await page.getByRole('link', { name: 'Saved' }).click();

  const tray = page.getByRole('region', { name: 'Selected saved courses' });
  await expect(tray).toBeHidden();

  await page.getByLabel('Select TDT4136').click();
  await expect(tray).toBeVisible();
  await expect(tray.getByText('1 selected')).toBeVisible();
  await expectNoAxeViolations(page);

  await tray.getByRole('button', { name: 'Add labels' }).click();
  await expect(page.getByRole('heading', { name: 'Labels for TDT4136' })).toBeVisible();
  await page.getByRole('button', { name: 'Close labels' }).click();

  // Selection is ephemeral: it never enters the URL and a reload drops it.
  await expect(page).not.toHaveURL(/select/);
  await page.reload();
  await expect(tray).toBeHidden();
});

test('every bottom-navigation destination shares one icon baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await waitForEnrichedCatalogue(page);

  const bar = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(bar).toBeVisible();

  /**
   * One destination is a button rather than a link, which is exactly where a
   * stray `font` shorthand once reset the shared `leading-none` and floated
   * its icon above the row. Measuring the glyphs keeps that a number rather
   * than something a person has to notice.
   */
  const tops = await bar.evaluate((element) =>
    [...element.children].map((child) => {
      const glyph = child.querySelector('svg');
      return glyph === null ? null : Math.round(glyph.getBoundingClientRect().top);
    }),
  );

  const measured = tops.filter((top): top is number => top !== null);
  expect(measured.length).toBeGreaterThan(1);
  expect(Math.max(...measured) - Math.min(...measured)).toBe(0);
});

test('a course reporting both grading scales offers a choice of view', async ({ page }) => {
  await waitForEnrichedCatalogue(page);

  /**
   * TMA4115 changed scheme inside the observed period, so it reports letter
   * and pass/fail buckets together. That is the only case where showing both
   * readings at once would be redundant, and the only case where this control
   * exists — until the fixture carried such a course, nothing could reach it.
   */
  const card = page.locator('article').filter({ hasText: 'TMA4115' }).first();
  await expect(card).toBeVisible();

  const scale = card.getByRole('group', { name: 'Choose historical outcome scale' });
  await expect(scale).toBeVisible();

  const passFail = scale.getByRole('button', { name: 'Pass/fail' });
  await passFail.click();
  await expect(passFail).toHaveAttribute('aria-pressed', 'true');

  const letters = scale.getByRole('button', { name: 'Letter grades' });
  await letters.click();
  await expect(letters).toHaveAttribute('aria-pressed', 'true');
});
