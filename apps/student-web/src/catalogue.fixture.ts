/**
 * The fixture catalogue.
 *
 * `VITE_USE_FIXTURE` builds — local development and the Playwright journeys —
 * serve every course from this list. It existed as a single course, which made
 * whole product surfaces unreachable: filtering a saved list needs more than
 * one course to filter, and the pass/fail toggle only appears when a course
 * reports both grading scales, so no journey could ever render it.
 *
 * Each entry is a descriptor, not a response. `course-client.ts` expands these
 * into search results, grade summaries, and decision signals, so a course is
 * described once and the three surfaces cannot disagree about it.
 *
 * None of this is real NTNU data. Course codes and titles are recognisable so
 * the fixture reads naturally, but every fact is invented and every piece of
 * evidence is marked `kind: 'fixture'`, which is what keeps it from being
 * mistaken for a source.
 */

export type FixtureAssessmentForm =
  | 'written-exam'
  | 'oral-exam'
  | 'home-exam'
  | 'project'
  | 'portfolio'
  | 'practical'
  | 'assignment'
  | 'other';

export type FixtureWorkForm =
  | 'lectures'
  | 'exercises'
  | 'laboratory'
  | 'seminar'
  | 'project'
  | 'self-study'
  | 'other';

/**
 * How a course's outcomes are reported. `mixed` is the case worth keeping: a
 * course that changed scheme inside the observed period reports both letter
 * and pass/fail buckets, which is exactly when the interface must offer a
 * choice of view rather than show two redundant readings.
 */
export type FixtureGrades =
  | { readonly scale: 'letter'; readonly buckets: ReadonlyArray<readonly [string, number]> }
  | { readonly scale: 'pass-fail'; readonly buckets: ReadonlyArray<readonly [string, number]> }
  | { readonly scale: 'mixed'; readonly buckets: ReadonlyArray<readonly [string, number]> }
  | { readonly scale: 'unavailable'; readonly reason: string };

export interface FixtureCourse {
  readonly code: string;
  readonly title: string;
  readonly credits: number;
  readonly level: 'bachelor' | 'master';
  readonly teachingLanguage: string;
  readonly academicYear: number;
  readonly season: 'autumn' | 'spring';
  readonly campuses: ReadonlyArray<string>;
  readonly assessmentForms: ReadonlyArray<FixtureAssessmentForm>;
  readonly workForms: ReadonlyArray<FixtureWorkForm>;
  readonly period: readonly [number, number];
  readonly grades: FixtureGrades;
}

export const fixtureCourses: ReadonlyArray<FixtureCourse> = [
  {
    code: 'TDT4136',
    title: 'Introduction to Artificial Intelligence',
    credits: 7.5,
    level: 'bachelor',
    teachingLanguage: 'English',
    academicYear: 2026,
    season: 'autumn',
    campuses: ['Trondheim'],
    assessmentForms: ['written-exam'],
    workForms: ['lectures', 'exercises', 'self-study'],
    period: [2022, 2025],
    grades: {
      scale: 'letter',
      buckets: [
        ['A', 200],
        ['B', 430],
        ['C', 650],
        ['D', 350],
        ['E', 112],
        ['F', 209],
      ],
    },
  },
  {
    code: 'TDT4109',
    title: 'Information Technology, Introduction',
    credits: 7.5,
    level: 'bachelor',
    teachingLanguage: 'Norwegian',
    academicYear: 2026,
    season: 'autumn',
    campuses: ['Trondheim'],
    assessmentForms: ['portfolio', 'assignment'],
    workForms: ['lectures', 'laboratory', 'self-study'],
    period: [2022, 2025],
    grades: {
      scale: 'pass-fail',
      buckets: [
        ['G', 1284],
        ['H', 143],
      ],
    },
  },
  {
    /** Changed scheme mid-period, so both scales are present and the view offers a choice. */
    code: 'TMA4115',
    title: 'Calculus 3',
    credits: 7.5,
    level: 'bachelor',
    teachingLanguage: 'Norwegian',
    academicYear: 2027,
    season: 'spring',
    campuses: ['Trondheim', 'Gjøvik'],
    assessmentForms: ['written-exam', 'assignment'],
    workForms: ['lectures', 'exercises'],
    period: [2021, 2025],
    grades: {
      scale: 'mixed',
      buckets: [
        ['A', 118],
        ['B', 254],
        ['C', 402],
        ['D', 233],
        ['E', 96],
        ['F', 187],
        ['G', 311],
        ['H', 62],
      ],
    },
  },
  {
    code: 'TDT4290',
    title: 'Customer Driven Project',
    credits: 15,
    level: 'bachelor',
    teachingLanguage: 'English',
    academicYear: 2026,
    season: 'autumn',
    campuses: ['Trondheim'],
    assessmentForms: ['project'],
    workForms: ['project', 'seminar'],
    period: [2022, 2025],
    grades: {
      scale: 'pass-fail',
      buckets: [
        ['G', 612],
        ['H', 21],
      ],
    },
  },
  {
    code: 'IT2805',
    title: 'Web Technologies',
    credits: 7.5,
    level: 'bachelor',
    teachingLanguage: 'Norwegian',
    academicYear: 2026,
    season: 'autumn',
    campuses: ['Trondheim'],
    assessmentForms: ['portfolio'],
    workForms: ['lectures', 'exercises', 'project'],
    period: [2022, 2025],
    grades: {
      scale: 'letter',
      buckets: [
        ['A', 310],
        ['B', 402],
        ['C', 288],
        ['D', 96],
        ['E', 41],
        ['F', 55],
      ],
    },
  },
  {
    /**
     * A real catalogue title is long, and it arrives with enrichment rather
     * than with the saved identity — so a row that fits while loading can stop
     * fitting once it knows what it is holding.
     */
    code: 'SKOLE6119',
    title: 'Den nasjonale rektorutdanningen ved NTNU',
    credits: 30,
    level: 'master',
    teachingLanguage: 'Norwegian',
    academicYear: 2026,
    season: 'autumn',
    campuses: ['Trondheim'],
    assessmentForms: ['portfolio'],
    workForms: ['seminar', 'self-study'],
    period: [2022, 2025],
    grades: {
      scale: 'pass-fail',
      buckets: [
        ['G', 214],
        ['H', 9],
      ],
    },
  },
  {
    /** Small cohort: the source suppresses the distribution, and that stays visible. */
    code: 'TDT4225',
    title: 'Management of Very Large Data',
    credits: 7.5,
    level: 'master',
    teachingLanguage: 'English',
    academicYear: 2026,
    season: 'autumn',
    campuses: ['Trondheim'],
    assessmentForms: ['written-exam', 'project'],
    workForms: ['lectures', 'project'],
    period: [2022, 2025],
    grades: {
      scale: 'unavailable',
      reason: 'The cohort is too small for the fixture source to publish a distribution.',
    },
  },
];

export const findFixtureCourse = (courseCode: string): FixtureCourse | undefined => {
  const normalized = courseCode.trim().toUpperCase();
  return fixtureCourses.find((course) => course.code === normalized);
};

const total = (buckets: ReadonlyArray<readonly [string, number]>): number =>
  buckets.reduce((sum, [, count]) => sum + count, 0);

export const fixtureSampleSize = (grades: FixtureGrades): number =>
  grades.scale === 'unavailable' ? 0 : total(grades.buckets);

/** Percentages are derived, never authored, so they cannot drift from the counts. */
export const fixtureDistribution = (
  grades: FixtureGrades,
): ReadonlyArray<{ grade: string; count: number; percentage: number }> => {
  if (grades.scale === 'unavailable') return [];
  const sampleSize = total(grades.buckets);
  return grades.buckets.map(([grade, count]) => ({
    grade,
    count,
    percentage: Math.round((count / sampleSize) * 10000) / 100,
  }));
};

export const fixtureFailureRatePercent = (grades: FixtureGrades): number | null => {
  if (grades.scale === 'unavailable') return null;
  const failed = grades.buckets
    .filter(([grade]) => grade === 'F' || grade === 'H')
    .reduce((sum, [, count]) => sum + count, 0);
  return Math.round((failed / total(grades.buckets)) * 1000) / 10;
};
