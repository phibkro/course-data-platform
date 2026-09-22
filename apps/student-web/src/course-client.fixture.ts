import { CourseSearchPageSize } from '@course-data/course-contracts';

import { Effect } from 'effect';

import {
  findFixtureCourse,
  fixtureCourses,
  fixtureDistribution,
  fixtureFailureRatePercent,
  fixtureSampleSize,
} from './catalogue.fixture';
import {
  parseCourseDecisionSignals,
  parseCourseGradeSummaries,
  parseCourseSchedule,
  parseCourseSearch,
  type CourseClient,
  type CourseDecisionSignalsResponse,
  type CourseGradeSummariesResponse,
  type CourseScheduleResponse,
  type CourseSearchResponse,
} from './course-client';
import { partialCourseInsightFixture } from './course-insight.fixture';

/**
 * Every fixture response is expanded from `fixtureCourses`, so a course is
 * described in one place and search, outcomes, and decision signals cannot
 * disagree about it.
 */

export const fixtureSearchResponse = (page: number): CourseSearchResponse =>
  parseCourseSearch({
    items:
      page === 1
        ? fixtureCourses.map((course) => ({
            courseKey: `ntnu:${course.code}:${course.academicYear}-${course.season}`,
            institutionCode: 'NTNU',
            code: course.code,
            title: { state: 'known', value: course.title, evidenceIds: ['ntnu-course'] },
            credits: { state: 'known', value: course.credits, evidenceIds: ['ntnu-course'] },
            level: { state: 'known', value: course.level, evidenceIds: ['ntnu-course'] },
            offerings: {
              state: 'known',
              value: [
                {
                  academicYear: course.academicYear,
                  season: course.season,
                  campuses: [...course.campuses],
                  deliveryModes: ['in-person'],
                },
              ],
              evidenceIds: ['ntnu-course'],
            },
            assessmentSignals: {
              state: 'known',
              value: [...course.assessmentForms],
              evidenceIds: ['ntnu-assessment'],
            },
            workFormSignals: {
              state: 'known',
              value: [...course.workForms],
              evidenceIds: ['ntnu-teaching'],
            },
            enrichment: 'partial',
            evidence: partialCourseInsightFixture.item.evidence,
          }))
        : [],
    sourceStatuses: partialCourseInsightFixture.item.sourceStatuses,
    meta: {
      count: page === 1 ? fixtureCourses.length : 0,
      total: fixtureCourses.length,
      page,
      pageSize: CourseSearchPageSize,
      hasMore: false,
      exactMatchCode: null,
    },
  });

export const fixtureGradeSummariesResponse = (
  courseCodes: ReadonlyArray<string>,
): CourseGradeSummariesResponse =>
  parseCourseGradeSummaries({
    items: courseCodes.map((courseCode) => {
      const normalizedCode = courseCode.trim().toUpperCase();
      const course = findFixtureCourse(normalizedCode);
      const grades = course?.grades;
      // A course the fixture does not know, and a known course whose outcomes
      // the source suppresses, are different facts. Both stay unavailable
      // rather than empty, and each says why.
      const reason =
        grades === undefined
          ? 'No official DBH/HK-dir grade outcomes were found for this period.'
          : grades.scale === 'unavailable'
            ? grades.reason
            : '';
      const available = grades !== undefined && grades.scale !== 'unavailable';
      const evidenceId = 'grades-fixture';
      const failureRate = grades === undefined ? null : fixtureFailureRatePercent(grades);
      return {
        courseCode: normalizedCode,
        period:
          available && course !== undefined
            ? {
                state: 'known',
                value: { fromYear: course.period[0], toYear: course.period[1] },
                evidenceIds: [evidenceId],
              }
            : { state: 'unavailable', reason, evidenceIds: [] },
        sampleSize:
          available && grades !== undefined
            ? { state: 'known', value: fixtureSampleSize(grades), evidenceIds: [evidenceId] }
            : { state: 'unavailable', reason, evidenceIds: [] },
        distribution:
          available && grades !== undefined
            ? {
                state: 'known',
                value: fixtureDistribution(grades),
                evidenceIds: [evidenceId],
              }
            : { state: 'unavailable', reason, evidenceIds: [] },
        failureRatePercent:
          available && failureRate !== null
            ? { state: 'known', value: failureRate, evidenceIds: [evidenceId] }
            : { state: 'unavailable', reason, evidenceIds: [] },
        gradingScale:
          available && grades !== undefined
            ? { state: 'known', value: grades.scale, evidenceIds: [evidenceId] }
            : { state: 'unavailable', reason, evidenceIds: [] },
        evidence: available
          ? [
              {
                id: evidenceId,
                provider: 'dbh',
                kind: 'fixture' as const,
                recordId: `dbh:308:${normalizedCode}:2022-2025`,
                sourceUrl: null,
                sourcePeriod: '2022-2025',
                observedAt: '2026-07-24T01:00:00.000Z',
                excerpt: null,
                inferenceRule: null,
              },
            ]
          : [],
      };
    }),
    sourceStatuses: [
      {
        provider: 'dbh',
        status: 'available',
        observedAt: '2026-07-24T01:00:00.000Z',
        warning: null,
      },
    ],
    meta: { count: courseCodes.length, fromYear: 2022, toYear: 2025 },
  });

export const fixtureDecisionSignalsResponse = (
  courseCodes: ReadonlyArray<string>,
): CourseDecisionSignalsResponse =>
  parseCourseDecisionSignals({
    items: courseCodes.map((courseCode) => {
      const normalizedCode = courseCode.trim().toUpperCase();
      const course = findFixtureCourse(normalizedCode);
      const available = course !== undefined;
      const reason = 'The fixture contains no NTNU decision signals for this course.';
      return {
        courseCode: normalizedCode,
        credits: course
          ? { state: 'known' as const, value: course.credits, evidenceIds: ['ntnu-course'] }
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        assessment: course
          ? {
              state: 'known' as const,
              // The catalogue names each part's form; the surrounding detail is
              // shared, so a fixture course does not have to restate it.
              value: course.assessmentForms.map((form, index) => ({
                ...partialCourseInsightFixture.item.assessment.value[0]!,
                form,
                weightPercent: {
                  state: 'known' as const,
                  value: Math.round((100 / course.assessmentForms.length) * 100) / 100,
                  evidenceIds: ['ntnu-assessment'],
                },
                description:
                  index === 0
                    ? 'Principal assessment component'
                    : 'Additional assessment component',
              })),
              evidenceIds: ['ntnu-assessment'],
            }
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        workFormSignals: course
          ? {
              state: 'known' as const,
              value: [...course.workForms],
              evidenceIds: ['ntnu-teaching'],
            }
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        obligatoryActivities: available
          ? partialCourseInsightFixture.item.obligatoryActivities
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        collaboration: available
          ? partialCourseInsightFixture.item.collaboration
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        attendance: available
          ? partialCourseInsightFixture.item.attendance
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        onlineParticipation: available
          ? partialCourseInsightFixture.item.onlineParticipation
          : { state: 'unavailable' as const, reason, evidenceIds: [] },
        sourceStatus: {
          provider: 'ntnu-course-page',
          status: available ? ('available' as const) : ('unavailable' as const),
          observedAt: available ? '2026-07-24T01:00:00.000Z' : null,
          warning: available ? null : reason,
        },
        evidence: available ? partialCourseInsightFixture.item.evidence : [],
      };
    }),
    meta: { count: courseCodes.length },
  });

export const fixtureScheduleResponse = (
  courseCodes: ReadonlyArray<string>,
  term: string,
  week: number,
): CourseScheduleResponse =>
  parseCourseSchedule({
    items: courseCodes.map((courseCode) => {
      const normalizedCode = courseCode.trim().toUpperCase();
      const knownCourse = findFixtureCourse(normalizedCode);
      const hasPublishedTermActivities = normalizedCode === 'TDT4136' && term === '2026-autumn';
      const hasWeekFortyFiveEvents = hasPublishedTermActivities && week === 45;
      return {
        courseCode: normalizedCode,
        sourceStatus:
          knownCourse === undefined
            ? {
                provider: 'NTNU schedule fixture',
                status: 'unavailable' as const,
                observedAt: null,
                warning: 'The fixture has no published schedule for this course.',
              }
            : {
                provider: 'NTNU schedule fixture',
                status: 'available' as const,
                observedAt: '2026-09-22T08:00:00.000Z',
                warning: null,
              },
        activityStreams: hasPublishedTermActivities
          ? [
              {
                activityCode: 'lecture',
                title: 'Search and planning',
                summary: 'Published lecture activity.',
              },
              {
                activityCode: 'exercise',
                title: 'Constraint satisfaction exercise',
                summary: null,
              },
            ]
          : [],
        occurrences: hasWeekFortyFiveEvents
          ? [
              {
                id: 'tdt4136-2026-w45-lecture',
                courseCode: normalizedCode,
                activityCode: 'lecture',
                title: 'Search and planning',
                summary: 'Published lecture activity.',
                status: 'published',
                startsAt: '2026-11-02T09:15:00+01:00',
                endsAt: '2026-11-02T11:00:00+01:00',
                rooms: [{ building: 'IT-bygget', room: 'R2', url: null }],
                evidence: {
                  provider: 'ntnu-course-schedule',
                  kind: 'fixture' as const,
                  sourceRecordId: 'fixture:tdt4136:2026-w45:lecture',
                  sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
                  observedAt: '2026-09-22T08:00:00.000Z',
                },
              },
              {
                id: 'tdt4136-2026-w45-exercise',
                courseCode: normalizedCode,
                activityCode: 'exercise',
                title: 'Constraint satisfaction exercise',
                summary: null,
                status: 'published',
                startsAt: '2026-11-04T12:15:00+01:00',
                endsAt: '2026-11-04T14:00:00+01:00',
                rooms: [{ building: 'IT-bygget', room: 'R5', url: null }],
                evidence: {
                  provider: 'ntnu-course-schedule',
                  kind: 'fixture' as const,
                  sourceRecordId: 'fixture:tdt4136:2026-w45:exercise',
                  sourceUrl: 'https://www.ntnu.edu/studies/courses/TDT4136',
                  observedAt: '2026-09-22T08:00:00.000Z',
                },
              },
            ]
          : [],
      };
    }),
    meta: {
      count:
        term === '2026-autumn' && week === 45
          ? courseCodes.filter((courseCode) => courseCode.trim().toUpperCase() === 'TDT4136')
              .length * 2
          : 0,
      term,
      week,
      timezone: 'Europe/Oslo',
      limitations: {
        activitySelection: 'all-published-activities',
        activityGrouping: 'unavailable',
        exceptionSemantics: 'provider-status-unverified',
      },
    },
  });

export const makeFixtureCourseClient = (): CourseClient => ({
  search: (request) =>
    Effect.sleep('150 millis').pipe(Effect.as(fixtureSearchResponse(request.page))),
  getGradeSummaries: (courseCodes) =>
    Effect.sleep('100 millis').pipe(Effect.as(fixtureGradeSummariesResponse(courseCodes))),
  getDecisionSignals: (courseCodes) =>
    Effect.sleep('120 millis').pipe(Effect.as(fixtureDecisionSignalsResponse(courseCodes))),
  getSchedule: (courseCodes, term, week) =>
    Effect.sleep('120 millis').pipe(Effect.as(fixtureScheduleResponse(courseCodes, term, week))),
  getInsight: (courseCode) => {
    const normalizedCode = courseCode.trim().toUpperCase();
    if (normalizedCode !== 'TDT4136') {
      return Effect.fail(new Error('The local walking skeleton currently contains only TDT4136.'));
    }
    return Effect.sleep('250 millis').pipe(Effect.as(partialCourseInsightFixture));
  },
});
