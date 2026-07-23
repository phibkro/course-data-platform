import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import source from '../fixtures/tdt4136-detail.source.json';
import { parseNtnuCourseDetail } from './detail.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/tdt4136-detail.html', import.meta.url));
const fixtureHtml = readFileSync(fixturePath, 'utf-8');

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  requestUrl: source.requestUrl,
  courseCode: source.courseCode,
};

describe('parseNtnuCourseDetail', () => {
  it('extracts labeled sections and infers work-form/collaboration signals for TDT4136', () => {
    const result = parseNtnuCourseDetail(fixtureHtml, capture);

    expect(result.rejected).toBeNull();
    const detail = result.accepted;
    expect(detail).not.toBeNull();
    expect(detail?.credits).toBe(7.5);
    expect(detail?.teachingLanguage).toBe('English');
    expect(detail?.content.state).toBe('known');
    expect(detail?.assessmentFormGuesses).toContain('written-exam');
    expect(detail?.collaborationSignal).toBe('mixed');
    expect(detail?.attendanceSignal).toBe('not-required');
    expect(detail?.workFormSignals).toEqual(expect.arrayContaining(['lectures', 'exercises']));
    expect(detail?.obligatoryActivities).toMatchObject({ state: 'known' });
    expect(detail?.prerequisites).toMatchObject({ state: 'known', value: 'Ingen' });
  });

  it('marks a section as unavailable rather than throwing when the page omits it', () => {
    const minimal = '<html><body><h2>Studiepoeng</h2><p>7.5</p></body></html>';
    const result = parseNtnuCourseDetail(minimal, capture);

    expect(result.rejected).toBeNull();
    expect(result.accepted?.content).toMatchObject({ state: 'unavailable' });
    expect(result.accepted?.collaborationSignal).toBeNull();
  });

  it('rejects an empty response instead of producing a false detail record', () => {
    const result = parseNtnuCourseDetail('   ', capture);

    expect(result.accepted).toBeNull();
    expect(result.rejected?.code).toBe('empty-response');
  });
});
