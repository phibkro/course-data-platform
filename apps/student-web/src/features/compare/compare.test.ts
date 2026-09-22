import { Option } from 'effect';
import { describe, expect, test } from 'vitest';

import {
  fixtureDecisionSignalsResponse,
  fixtureGradeSummariesResponse,
  fixtureSearchResponse,
} from '../../course-client';
import {
  courseIdentity,
  emptySavedList,
  saveCourse,
  savedCoursesNewestFirst,
} from '../../saved-courses';
import {
  ClosedCompare,
  ToggledCompareDifferencesOnly,
  compareRows,
  init,
  update,
  type CompareCourseFacts,
} from './index';

const identity = (courseCode: string) => {
  const parsed = courseIdentity(courseCode);
  if (parsed === null) throw new Error(`Expected a valid course code: ${courseCode}`);
  return parsed;
};

const savedPair = () =>
  saveCourse(
    saveCourse(emptySavedList, identity('TDT4136'), '2026-07-24T12:00:00.000Z'),
    identity('TDT4290'),
    '2026-07-24T12:01:00.000Z',
  );

describe('saved-course comparison', () => {
  test('uses loaded decision credits when catalogue credits are unavailable', () => {
    const search = fixtureSearchResponse(1);
    const catalogueWithUnavailableCredits = {
      ...search,
      items: search.items.map((item) =>
        item.code === 'TDT4136' || item.code === 'TDT4290'
          ? {
              ...item,
              credits: {
                state: 'unknown' as const,
                reason: 'Course credits require the NTNU detail page.',
                evidenceIds: [],
              },
            }
          : item,
      ),
    };
    const decisions = fixtureDecisionSignalsResponse(['TDT4136', 'TDT4290']);
    const facts: ReadonlyArray<CompareCourseFacts> = savedCoursesNewestFirst(savedPair()).map(
      (course) => ({
        course,
        item:
          catalogueWithUnavailableCredits.items.find((item) => item.code === course.courseCode) ??
          null,
        decisionSignal:
          decisions.items.find((item) => item.courseCode === course.courseCode) ?? null,
        gradeSignal: null,
      }),
    );

    const credits = compareRows('en', facts).find((row) => row.label === 'Credits');
    expect(credits?.cells.map((cell) => cell.text)).toEqual(['15 credits', '7.5 credits']);
  });

  test('keeps unavailable facts named instead of rendering them as zero or false', () => {
    const search = fixtureSearchResponse(1);
    const grade = fixtureGradeSummariesResponse(['TDT4136']).items[0]!;
    const facts: ReadonlyArray<CompareCourseFacts> = savedCoursesNewestFirst(savedPair()).map(
      (course) => ({
        course,
        item: search.items.find((item) => item.code === course.courseCode) ?? null,
        decisionSignal: null,
        gradeSignal:
          course.courseCode === 'TDT4136'
            ? {
                ...grade,
                failureRatePercent: {
                  state: 'unknown' as const,
                  reason: 'The provider did not publish this rate.',
                  evidenceIds: grade.failureRatePercent.evidenceIds,
                },
              }
            : null,
      }),
    );

    const failureRate = compareRows('en', facts).find((row) => row.label === 'Failure rate');
    expect(failureRate?.cells.map((cell) => cell.text).sort()).toEqual(['Not loaded', 'Unknown']);
    expect(failureRate?.cells.every((cell) => !cell.known)).toBe(true);
  });

  test('comparison controls are explicit Foldkit transitions', () => {
    const comparison = init(['TDT4136', 'TDT4290']);
    const [showAll, showAllCommands, showAllOut] = update(
      comparison,
      ToggledCompareDifferencesOnly({ differencesOnly: false }),
    );
    expect(showAll.differencesOnly).toBe(false);
    expect(showAllCommands).toEqual([]);
    expect(Option.isNone(showAllOut)).toBe(true);

    const [closed, closeCommands, closeOut] = update(showAll, ClosedCompare());
    expect(closed.codes).toEqual([]);
    expect(closeCommands).toEqual([]);
    expect(Option.isSome(closeOut)).toBe(true);
  });
});
