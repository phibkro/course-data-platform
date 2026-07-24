import { Story } from 'foldkit';
import { expect, test } from 'vitest';

import { fixtureGradeSummariesResponse, fixtureSearchResponse } from './course-client';
import {
  CatalogueEmpty,
  CompletedNavigation,
  FailedCourseSearch,
  FetchCourseSearch,
  FetchGradeSignals,
  GradeSignalsSuccess,
  Navigate,
  NextPageFailure,
  RequestedMoreCourses,
  SubmittedSearch,
  SucceededCourseSearch,
  SucceededGradeSignals,
  UpdatedQuery,
  initForHref,
  parseExternalHttpsUrl,
  update,
} from './main';

const initialModel = () => initForHref('http://course-lens.local/')[0];

test('external product links accept only absolute HTTPS destinations', () => {
  expect(parseExternalHttpsUrl('https://example.com/support')).toBe('https://example.com/support');
  expect(parseExternalHttpsUrl('http://example.com/support')).toBeNull();
  expect(parseExternalHttpsUrl('/relative')).toBeNull();
  expect(parseExternalHttpsUrl('not a url')).toBeNull();
  expect(parseExternalHttpsUrl(undefined)).toBeNull();
});

test('a catalogue response makes official courses available without opening detail', () => {
  const model = initialModel();
  Story.story(
    update,
    Story.with(model),
    Story.message(
      SucceededCourseSearch({
        requestKey: model.activeRequestKey,
        append: false,
        response: fixtureSearchResponse(1),
      }),
    ),
    Story.model((next) => {
      expect(next.catalogue._tag).toBe('CataloguePartial');
      expect(next.gradeSignals._tag).toBe('GradeSignalsLoading');
      expect(next.selectedCode).toBeNull();
      expect(next.visibleCount).toBe(1);
    }),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: model.activeRequestKey,
        courseCodes: ['TDT4136'],
        response: fixtureGradeSummariesResponse(['TDT4136']),
      }),
    ),
  );
});

test('grade responses enrich cards independently of the catalogue response', () => {
  const model = initialModel();
  const [loaded] = update(
    model,
    SucceededCourseSearch({
      requestKey: model.activeRequestKey,
      append: false,
      response: fixtureSearchResponse(1),
    }),
  );

  const [enriched] = update(
    loaded,
    SucceededGradeSignals({
      requestKey: model.activeRequestKey,
      courseCodes: ['TDT4136'],
      response: fixtureGradeSummariesResponse(['TDT4136']),
    }),
  );

  expect(enriched.gradeSignals).toEqual(
    GradeSignalsSuccess({ response: fixtureGradeSummariesResponse(['TDT4136']) }),
  );
});

test('submitting a title or course-code query starts a fresh URL-backed search', () => {
  Story.story(
    update,
    Story.with(initialModel()),
    Story.message(UpdatedQuery({ value: '  algoritmer  ' })),
    Story.message(SubmittedSearch()),
    Story.Command.expectHas(Navigate),
    Story.Command.expectHas(FetchCourseSearch),
    Story.model((model) => {
      expect(model.query).toBe('algoritmer');
      expect(model.sort).toBe('relevance');
      expect(model.catalogue._tag).toBe('CatalogueInitialLoading');
      expect(model.activeRequestKey).toContain('algoritmer');
    }),
    Story.Command.resolve(Navigate, CompletedNavigation()),
    Story.Command.resolve(
      FetchCourseSearch,
      SucceededCourseSearch({
        requestKey: 'algoritmer|2026-autumn|relevance|all|all|true|false|false',
        append: false,
        response: fixtureSearchResponse(1),
      }),
    ),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: 'algoritmer|2026-autumn|relevance|all|all|true|false|false',
        courseCodes: ['TDT4136'],
        response: fixtureGradeSummariesResponse(['TDT4136']),
      }),
    ),
  );
});

test('an initial search failure is distinct from an empty result', () => {
  const model = initialModel();
  Story.story(
    update,
    Story.with(model),
    Story.message(
      FailedCourseSearch({
        requestKey: model.activeRequestKey,
        append: false,
        error: 'NTNU unavailable',
      }),
    ),
    Story.model((next) => {
      expect(next.catalogue).toMatchObject({
        _tag: 'CatalogueFailure',
        error: 'NTNU unavailable',
      });
      expect(next.catalogue).not.toEqual(CatalogueEmpty());
    }),
  );
});

test('a later-page failure preserves already loaded catalogue rows', () => {
  const model = initialModel();
  const response = {
    ...fixtureSearchResponse(1),
    meta: { ...fixtureSearchResponse(1).meta, hasMore: true },
  };
  Story.story(
    update,
    Story.with(model),
    Story.message(
      SucceededCourseSearch({
        requestKey: model.activeRequestKey,
        append: false,
        response,
      }),
    ),
    Story.Command.resolve(
      FetchGradeSignals,
      SucceededGradeSignals({
        requestKey: model.activeRequestKey,
        courseCodes: ['TDT4136'],
        response: fixtureGradeSummariesResponse(['TDT4136']),
      }),
    ),
    Story.message(RequestedMoreCourses()),
    Story.Command.resolve(
      FetchCourseSearch,
      FailedCourseSearch({
        requestKey: model.activeRequestKey,
        append: true,
        error: 'Next page failed',
      }),
    ),
    Story.model((next) => {
      expect(next.catalogue._tag).toBe('CataloguePartial');
      expect(next.nextPage).toEqual(NextPageFailure({ error: 'Next page failed' }));
    }),
  );
});

test('show more reveals already loaded rows before requesting another provider page', () => {
  const model = initialModel();
  const fixture = fixtureSearchResponse(1);
  const items = Array.from({ length: 41 }, (_, index) => {
    const item = fixture.items[0]!;
    const code = `TEST${String(index + 1).padStart(3, '0')}`;
    return { ...item, courseKey: `NTNU:${code}`, code };
  });
  const [loaded] = update(
    model,
    SucceededCourseSearch({
      requestKey: model.activeRequestKey,
      append: false,
      response: {
        ...fixture,
        items,
        meta: { ...fixture.meta, count: items.length, total: items.length },
      },
    }),
  );

  const [revealed, commands] = update(loaded, RequestedMoreCourses());

  expect(revealed.visibleCount).toBe(41);
  expect(revealed.gradeSignals).toMatchObject({
    _tag: 'GradeSignalsLoading',
    pendingCodes: expect.arrayContaining(['TEST041']),
  });
  expect(commands).toHaveLength(1);
});
