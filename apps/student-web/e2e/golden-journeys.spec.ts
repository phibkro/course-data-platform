import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

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

const courseLink = (page: Page, courseCode: string) =>
  page.getByRole('link', { name: new RegExp(`^Open ${courseCode}:`) });

const openEnrichedExplore = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Course results' })).toBeVisible();
  await expect(page.getByText('Assessment & work', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Historical outcomes', { exact: true }).first()).toBeVisible();
};

const saveCourse = async (page: Page, courseCode: string): Promise<void> => {
  await page.getByRole('button', { name: `Save ${courseCode} to List` }).click();
  await expect(page.getByRole('button', { name: `Remove ${courseCode} from List` })).toBeVisible();
};

const savedCourseRow = (page: Page, courseCode: string) =>
  page.getByRole('listitem').filter({ has: courseLink(page, courseCode) });

const addLabel = async (page: Page, courseCode: string, name: string): Promise<void> => {
  await page.getByRole('button', { name: `Edit labels for ${courseCode}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Label name').fill(name);
  await dialog.getByRole('button', { name: 'Add label' }).click();
  await expect(dialog.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked();
  await dialog.getByRole('button', { name: 'Close labels' }).click();
  await expect(dialog).toBeHidden();
};

const expectNoMobileOverflow = async (page: Page, deviceWidth: number): Promise<void> => {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(deviceWidth);
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('GJ-01 Find a plausible course', { tag: '@fixture' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Course results' })).toBeVisible();

  const search = page.getByLabel('Search courses');
  await search.fill('TDT4136');
  await search.press('Enter');

  await expect(page).toHaveURL(/(?:\?|&)q=TDT4136(?:&|$)/);
  await expect(courseLink(page, 'TDT4136')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Course results' })
      .getByRole('listitem')
      .first()
      .getByRole('link', { name: /^Open TDT4136:/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Refine' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoAxeViolations(page);

  await dialog.getByRole('button', { name: 'Term' }).click();
  await page.getByRole('option', { name: 'Spring 2027' }).click();
  await dialog.getByRole('button', { name: 'View results' }).click();

  await expect(page).toHaveURL(/(?:\?|&)term=2026-spring(?:&|$)/);
  await expect(page.getByRole('button', { name: /^Refine · \d+$/ })).toBeVisible();

  const candidate = courseLink(page, 'TDT4136');
  await expect(candidate).toBeVisible();
  await candidate.focus();
  await candidate.press('Enter');
  await expect(page.getByRole('article', { name: 'TDT4136 course details' })).toBeVisible();
});

test('GJ-02 Understand and trust a candidate', { tag: '@real-http' }, async ({ page }) => {
  const insightResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === 'http://127.0.0.1:4176' &&
      url.pathname === '/v1/courses/TDT4136/insight' &&
      response.status() === 200
    );
  });

  await page.goto('/?course=TDT4136');
  await insightResponse;

  const detail = page.getByRole('article', { name: 'TDT4136 course details' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Partial result', { exact: true })).toBeVisible();
  await expect(detail.getByText('Project', { exact: true })).toBeVisible();
  await expect(detail.getByText('Oral Exam', { exact: true })).toBeVisible();
  await expect(
    detail.getByText(
      /Grade weight: Unknown\. Structured ordinary assessment weights total 120%, not 100%\./,
    ),
  ).toHaveCount(2);
  await expect(detail.getByText(/ · 60%/)).toHaveCount(0);
  await expect(detail.getByRole('heading', { name: 'Sources and freshness' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('GJ-03 Continue under imperfect evidence', { tag: '@fixture' }, async ({ page }) => {
  await page.goto('/');
  await expect(courseLink(page, 'TDT4136')).toBeVisible();

  // Saving is available when the catalogue identifies a course; it does not wait for enrichment.
  await saveCourse(page, 'TDT4136');

  const candidate = page.getByRole('listitem').filter({ has: courseLink(page, 'TDT4225') });
  await expect(candidate).toBeVisible();
  await expect(candidate.getByText('Assessment & work', { exact: true })).toBeVisible();
  await expect(candidate.getByText('Written exam', { exact: true })).toBeVisible();
  await expect(
    candidate.getByText('No published outcome distribution', { exact: true }),
  ).toBeVisible();
  await expect(candidate.getByText('0%', { exact: true })).toHaveCount(0);
});

test('GJ-04 Remember and safely return', { tag: '@fixture' }, async ({ page }) => {
  await openEnrichedExplore(page);
  await saveCourse(page, 'TDT4136');

  await page.getByRole('link', { name: 'Saved' }).first().click();
  await expect(page.getByRole('heading', { name: 'Saved courses and results' })).toBeVisible();

  const saved = savedCourseRow(page, 'TDT4136');
  await saved.getByLabel('Your note').fill('Ask the adviser about the project');
  await saved.getByRole('button', { name: 'Save note' }).click();

  await page.reload();
  await expect(savedCourseRow(page, 'TDT4136').getByLabel('Your note')).toHaveValue(
    'Ask the adviser about the project',
  );

  await page.getByRole('button', { name: 'Remove TDT4136 from List' }).click();
  await expect(
    page.getByText('You have no saved courses or NTNU results yet', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo removing TDT4136' }).click();
  await expect(savedCourseRow(page, 'TDT4136').getByLabel('Your note')).toHaveValue(
    'Ask the adviser about the project',
  );
  await expectNoAxeViolations(page);
});

test('GJ-05 Organize a shortlist', { tag: '@fixture' }, async ({ page }) => {
  await openEnrichedExplore(page);
  for (const courseCode of ['TDT4136', 'TDT4109', 'IT2805']) {
    await saveCourse(page, courseCode);
  }

  await page.getByRole('link', { name: 'Saved' }).first().click();
  await expect(page.getByText('3 courses', { exact: true })).toBeVisible();

  await addLabel(page, 'TDT4136', 'AI');
  await addLabel(page, 'TDT4136', 'Autumn');

  await page.getByRole('button', { name: 'Edit labels for TDT4109' }).click();
  const dialog = page.getByRole('dialog');
  const autumn = dialog.getByRole('checkbox', { name: /Autumn/ });
  await autumn.click();
  await expect(autumn).toBeChecked();
  await dialog.getByRole('button', { name: 'Close labels' }).click();

  await page.getByRole('button', { name: /^AI/ }).click();
  await page.getByRole('button', { name: /^Autumn/ }).click();
  const matchMode = page.getByRole('radiogroup', { name: 'Match included labels' });
  await expect(matchMode).toBeVisible();
  await expect(matchMode.getByRole('radio', { name: /Any/ })).toContainText('2');
  await expect(matchMode.getByRole('radio', { name: /All/ })).toContainText('1');

  await matchMode.getByRole('radio', { name: /All/ }).click();
  await expect(page).toHaveURL(/(?:\?|&)labelMode=all(?:&|$)/);
  await expect(page.getByText('Showing 1 of 3 courses', { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Clear label filter' }).click();
  await expect(page).not.toHaveURL(/labels=|labelMode=/);

  await page.getByLabel('Exclude Autumn').click();
  await expect(page).toHaveURL(/(?:\?|&)notLabels=label-/);
  await expect(page.getByText('Showing 1 of 3 courses', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/notLabels=/);
  await expect(page.getByText('3 courses', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Unlabeled/ }).click();
  await expect(page).toHaveURL(/(?:\?|&)unlabeled=1(?:&|$)/);
  await expect(page.getByText('Showing 1 of 3 courses', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/unlabeled=/);
  await expect(page.getByText('3 courses', { exact: true })).toBeVisible();
});

test('GJ-06 Choose between finalists', { tag: '@fixture' }, async ({ page }) => {
  await openEnrichedExplore(page);

  await courseLink(page, 'TDT4136').click();
  await expect(page.getByRole('article', { name: 'TDT4136 course details' })).toBeVisible();
  await page.getByRole('button', { name: /Back to course results/ }).click();
  await expect(page.getByRole('region', { name: 'Course results' })).toBeVisible();

  await saveCourse(page, 'TDT4136');
  await saveCourse(page, 'TDT4109');
  await page.getByRole('link', { name: 'Saved' }).first().click();

  const firstFinalist = savedCourseRow(page, 'TDT4136');
  await firstFinalist.getByLabel('Your note').fill('Check the assessment fit');
  await firstFinalist.getByRole('button', { name: 'Save note' }).click();
  await addLabel(page, 'TDT4136', 'Finalist');

  await page.getByLabel('Select TDT4136').click();
  await page.getByLabel('Select TDT4109').click();
  const selection = page.getByRole('region', { name: 'Selected saved courses' });
  await selection.getByRole('button', { name: 'Compare' }).click();

  const compare = page.getByRole('region', { name: 'Compare saved courses' });
  await expect(compare).toBeVisible();
  await expect(compare.getByRole('columnheader', { name: 'TDT4136' })).toBeVisible();
  await expect(compare.getByRole('columnheader', { name: 'TDT4109' })).toBeVisible();
  await expect(compare.getByRole('rowheader', { name: 'Campus' })).toHaveCount(0);

  const differences = page.getByRole('checkbox', { name: 'Differences' });
  await expect(differences).toBeChecked();
  await differences.click();
  await expect(differences).not.toBeChecked();
  await expect(compare.getByRole('rowheader', { name: 'Campus' })).toBeVisible();
  await expect(page).toHaveURL(/(?:\?|&)compare=/);

  await page.reload();
  await expect(page.getByRole('region', { name: 'Compare saved courses' })).toBeVisible();
  await expect(savedCourseRow(page, 'TDT4136').getByLabel('Your note')).toHaveValue(
    'Check the assessment fit',
  );
  await expect(
    savedCourseRow(page, 'TDT4136').getByLabel('Labels on TDT4136').getByText('Finalist', {
      exact: true,
    }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('GJ-07 Recover without silent loss', { tag: ['@fixture', '@mobile'] }, async ({ page }) => {
  const deviceWidth = 320;
  await page.setViewportSize({ width: deviceWidth, height: 720 });

  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('course-lens:list', '{not json'));
  await page.goto('/list');

  const recovery = page.getByRole('alert');
  await expect(recovery).toContainText('Saved courses could not be loaded');
  await page.getByText('Show the stored value', { exact: true }).click();
  await expect(
    page.getByText(
      'Nothing was deleted. The stored value is kept below so you can copy it before resetting.',
    ),
  ).toBeVisible();
  await expect(page.getByText('{not json', { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoMobileOverflow(page, deviceWidth);
  await page.getByRole('button', { name: 'Reset saved courses' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('course-lens:list')))
    .not.toContain('{not json');

  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('course-lens:list', JSON.stringify({ version: 999, savedCourses: [] })),
  );
  await page.goto('/list');
  await expect(page.getByRole('alert')).toContainText(
    /newer version of the saved list \(version 999\)/,
  );
  await expectNoMobileOverflow(page, deviceWidth);

  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('link', { name: 'Style' }).click();
  await expect(page.getByRole('heading', { name: 'Theme lab' })).toBeVisible();

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'Norsk bokmål' }).click();
  await expect(page.getByRole('heading', { name: 'Temalaboratorium' })).toBeVisible();
  await expectNoMobileOverflow(page, deviceWidth);

  await page.getByRole('button', { name: 'Språk' }).click();
  await page.getByRole('option', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Theme lab' })).toBeVisible();
  await expectNoMobileOverflow(page, deviceWidth);
});
