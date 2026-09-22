import type {
  CourseDecisionSignalsDtoType,
  CourseSearchItemDtoType,
} from '@course-data/course-contracts';
import { Match as M } from 'effect';

import { localeTag, translate, translateToken, type Localization } from './i18n';

export type DecisionSignal =
  | CourseDecisionSignalsDtoType
  | 'loading'
  | 'failure'
  | 'idle'
  | 'missing';

export const factStateLabel = (state: string, locale: Localization): string =>
  translateToken(locale, state);

export const formatOfferingPeriod = (
  academicYear: number,
  season: string,
  locale: Localization,
): string => {
  if (season === 'full-year') {
    const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
    return translate(locale, 'offering.academicYear', { year: academicYearLabel });
  }

  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${translateToken(locale, season)} ${calendarYear}`;
};

type CourseOffering = Extract<
  CourseSearchItemDtoType['offerings'],
  { readonly state: 'known' }
>['value'][number];

export interface CourseOfferingFacts {
  readonly offering: CourseOffering | null;
  readonly place: string;
  readonly term: string;
  readonly credits: string;
}

export const courseOfferingFacts = (
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  locale: Localization,
): CourseOfferingFacts => {
  const offering =
    course.offerings.state === 'known' && course.offerings.value.length > 0
      ? (course.offerings.value[0] ?? null)
      : null;
  const place =
    offering === null
      ? course.offerings.state === 'known'
        ? translate(locale, 'course.campusUnreported')
        : factStateLabel(course.offerings.state, locale)
      : offering.campuses.length === 0
        ? translate(locale, 'course.campusUnreported')
        : offering.campuses.join(', ');
  const term =
    offering === null
      ? course.offerings.state === 'known'
        ? translate(locale, 'course.termUnavailable')
        : factStateLabel(course.offerings.state, locale)
      : formatOfferingPeriod(offering.academicYear, offering.season, locale);
  const creditsFact =
    typeof decisionSignal !== 'string' && decisionSignal.credits.state === 'known'
      ? decisionSignal.credits
      : course.credits;
  const credits =
    creditsFact.state === 'known'
      ? translate(locale, 'course.creditsValue', {
          value: new Intl.NumberFormat(localeTag(locale.locale), {
            maximumFractionDigits: 1,
          }).format(creditsFact.value),
        })
      : factStateLabel(creditsFact.state, locale);
  return { offering, place, term, credits };
};

export type AssessmentForm =
  | 'written-exam'
  | 'oral-exam'
  | 'home-exam'
  | 'project'
  | 'portfolio'
  | 'practical'
  | 'assignment'
  | 'other';

export const assessmentLabel = (form: AssessmentForm, locale: Localization): string =>
  M.value(form).pipe(
    M.when('written-exam', () => translate(locale, 'signals.writtenExam')),
    M.when('oral-exam', () => translate(locale, 'signals.oralExam')),
    M.when('home-exam', () => translate(locale, 'signals.homeExam')),
    M.when('project', () => translate(locale, 'signals.project')),
    M.when('portfolio', () => translate(locale, 'signals.portfolio')),
    M.when('practical', () => translate(locale, 'signals.practical')),
    M.when('assignment', () => translate(locale, 'signals.assignment')),
    M.when('other', () => translate(locale, 'signals.otherAssessment')),
    M.exhaustive,
  );

export const collaborationLabel = (
  collaboration: 'individual' | 'group' | 'mixed',
  locale: Localization,
): string =>
  M.value(collaboration).pipe(
    M.when('individual', () => translate(locale, 'signals.individual')),
    M.when('group', () => translate(locale, 'signals.group')),
    M.when('mixed', () => translate(locale, 'signals.mixedCollaboration')),
    M.exhaustive,
  );

export const gradeScaleLabel = (
  scale: 'letter' | 'pass-fail' | 'mixed',
  locale: Localization,
): string =>
  M.value(scale).pipe(
    M.when('letter', () => translate(locale, 'outcomes.letter')),
    M.when('pass-fail', () => translate(locale, 'outcomes.passFail')),
    M.when('mixed', () => translate(locale, 'outcomes.mixed')),
    M.exhaustive,
  );

export const formatPercentage = (value: number, locale: Localization): string =>
  new Intl.NumberFormat(localeTag(locale.locale), { maximumFractionDigits: 1 }).format(value);
