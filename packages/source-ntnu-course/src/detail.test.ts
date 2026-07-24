import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import source from '../fixtures/tdt4136-detail.source.json';
import { parseNtnuCourseDetail } from './detail';

const fixturePath = fileURLToPath(new URL('../fixtures/tdt4136-detail.html', import.meta.url));
const fixtureHtml = readFileSync(fixturePath, 'utf-8');

const capture = {
  retrievedAt: source.capturedAt,
  contentHash: source.contentHash.rawBody,
  requestUrl: source.requestUrl,
  courseCode: source.courseCode,
  evidenceKind: 'fixture' as const,
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
    const minimal = '<html><body><h1>TDT4136</h1><h2>Studiepoeng</h2><p>7.5</p></body></html>';
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

  it('rejects a non-empty error page that does not identify the requested course', () => {
    const result = parseNtnuCourseDetail(
      '<html><body><h1>Page not found</h1></body></html>',
      capture,
    );

    expect(result.accepted).toBeNull();
    expect(result.rejected?.code).toBe('course-identity-mismatch');
  });

  it('marks extracted section text when the source continues beyond the display limit', () => {
    const longContent = 'Long course content. '.repeat(100);
    const result = parseNtnuCourseDetail(
      `<html><body><h1>TDT4136</h1><h2>Faglig innhold</h2><p>${longContent}</p><h2>Læringsutbytte</h2><p>Outcome</p></body></html>`,
      capture,
    );

    expect(result.accepted?.content).toMatchObject({ state: 'known' });
    expect(result.accepted?.content.state === 'known' ? result.accepted.content.value : '').toMatch(
      /… \[Truncated; continue at source\]$/,
    );
  });

  it('does not infer attendance or remote participation from unrelated page sections', () => {
    const result = parseNtnuCourseDetail(
      '<html><body><h1>TDT4136</h1><h2>Faglig innhold</h2><p>Mandatory attendance and online participation are research topics.</p><h2>Læringsformer og aktiviteter</h2><p>Forelesninger.</p></body></html>',
      capture,
    );

    expect(result.accepted?.attendanceSignal).toBeNull();
    expect(result.accepted?.onlineParticipationSignal).toBeNull();
  });

  it.each([
    ['Skriftlig skoleeksamen.', ['written-exam']],
    ['Muntlig eksamen.', ['oral-exam']],
    ['Hjemme-eksamen over 7 dager.', ['home-exam']],
    ['Mappevurdering med tre arbeider.', ['portfolio']],
    ['Prosjektrapport.', ['project']],
    ['Praktisk eksamen.', ['practical']],
    ['To obligatoriske innleveringer.', ['assignment']],
    ['Prosjektarbeid 60 %. Muntlig eksamen 40 %.', ['project', 'oral-exam']],
  ])('classifies assessment composition in source order: %s', (assessment, expected) => {
    const result = parseNtnuCourseDetail(
      `<html><body><h1>TDT4136</h1><h2>Vurderingsordning</h2><p>${assessment}</p></body></html>`,
      capture,
    );

    expect(result.accepted?.assessmentFormGuesses).toEqual(expected);
  });

  it('recognizes observed Norwegian collaboration and attendance phrases in obligatory work', () => {
    const result = parseNtnuCourseDetail(
      `
        <html><body>
          <h1>TDT4136</h1>
          <h2>Læringsformer og aktiviteter</h2><p>Individuelle studentaktiviteter.</p>
          <h2>Obligatoriske aktiviteter</h2>
          <p>Kollaborative studentaktiviteter. Obligatorisk tilstedeværelse.</p>
        </body></html>
      `,
      capture,
    );

    expect(result.accepted?.collaborationSignal).toBe('mixed');
    expect(result.accepted?.attendanceSignal).toBe('required');
  });
});
