import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import detailSource from '../fixtures/tdt4136-detail.source.json';
import searchFixture from '../fixtures/tdt4136-search.json';
import searchSource from '../fixtures/tdt4136-search.source.json';
import { parseNtnuCourseDetail } from './detail.ts';
import { mapNtnuToCourseInsightFields } from './map-course-insight.ts';
import { parseNtnuCourseSearch } from './search.ts';

const detailHtml = readFileSync(
  fileURLToPath(new URL('../fixtures/tdt4136-detail.html', import.meta.url)),
  'utf-8',
);

const searchCapture = {
  retrievedAt: searchSource.capturedAt,
  contentHash: searchSource.contentHash.rawBody,
  requestUrl: searchSource.requestUrl,
  queryString: searchSource.queryString,
  academicYear: searchSource.academicYear,
  season: searchSource.season as 'autumn',
};
const detailCapture = {
  retrievedAt: detailSource.capturedAt,
  contentHash: detailSource.contentHash.rawBody,
  requestUrl: detailSource.requestUrl,
  courseCode: detailSource.courseCode,
};

const search = parseNtnuCourseSearch(searchFixture, searchCapture).accepted.find(
  (hit) => hit.courseCode === 'TDT4136',
);
if (!search) throw new Error('fixture setup: TDT4136 search hit missing');

describe('mapNtnuToCourseInsightFields', () => {
  it('maps a successful search+detail pair into known CourseInsight fields', () => {
    const detail = parseNtnuCourseDetail(detailHtml, detailCapture).accepted;
    if (!detail) throw new Error('fixture setup: detail parse failed');

    const fields = mapNtnuToCourseInsightFields('ntnu:TDT4136:2026-autumn', search, detail, null);

    expect(fields.title).toMatchObject({ state: 'known', value: 'Introduction to Artificial Intelligence' });
    expect(fields.credits).toMatchObject({ state: 'known', value: 7.5 });
    expect(fields.teachingLanguage).toMatchObject({ state: 'known', value: 'English' });
    expect(fields.collaboration).toMatchObject({ state: 'known', value: 'mixed' });
    expect(fields.attendance).toMatchObject({ state: 'known', value: 'not-required' });
    expect(fields.assessment).toMatchObject({
      state: 'known',
      value: [{ form: 'written-exam' }],
    });
    expect(fields.sourceStatuses).toEqual([
      expect.objectContaining({ provider: 'ntnu-course-search', status: 'available' }),
      expect.objectContaining({ provider: 'ntnu-course-page', status: 'available' }),
    ]);
  });

  it('preserves search-derived facts and marks only detail facts unavailable on detail failure', () => {
    const fields = mapNtnuToCourseInsightFields(
      'ntnu:TDT4136:2026-autumn',
      search,
      null,
      'NTNU course-detail page returned HTTP 503.',
    );

    expect(fields.title).toMatchObject({ state: 'known', value: 'Introduction to Artificial Intelligence' });
    expect(fields.offerings.state).toBe('known');
    expect(fields.content).toMatchObject({ state: 'unavailable' });
    expect(fields.credits).toMatchObject({ state: 'unavailable' });
    expect(fields.sourceStatuses).toEqual([
      expect.objectContaining({ provider: 'ntnu-course-search', status: 'available' }),
      expect.objectContaining({
        provider: 'ntnu-course-page',
        status: 'failed',
        warning: 'NTNU course-detail page returned HTTP 503.',
      }),
    ]);
  });
});
