import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import dbhFixture from './grades/fixtures/tdt4136-dbh-308.json';
import dbhExamFixture from './grades/fixtures/tdt4136-dbh-905.json';
import searchFixture from './ntnu/fixtures/tdt4136-search.json';
import { parseDbhExamOutcomes } from './grades/dbh-exam-outcomes';
import { parseDbhGradeSummaries } from './grades/dbh-grade-summaries';
import { mapDbhToExamParticipation } from './grades/exam-participation';
import { mapGradesToOutcomes } from './grades/grade-outcomes';
import { mapDbhToGradeSummary } from './grades/grade-summary';
import { parseNtnuCourseDetail } from './ntnu/detail';
import { mapNtnuDetailToCourseDecisionSignals } from './ntnu/map-course-decision-signals';
import { parseNtnuCourseSearch } from './ntnu/search';

const contentHash = 'a'.repeat(64);
const searchCapture = {
  retrievedAt: '2026-07-24T12:00:00.000Z',
  contentHash,
  requestUrl: 'https://www.ntnu.no/web/studier/emnesok',
  queryString: 'TDT4136',
  academicYear: 2026,
  season: 'autumn' as const,
  evidenceKind: 'fixture' as const,
};
const detailCapture = {
  retrievedAt: '2026-07-24T12:00:00.000Z',
  contentHash,
  requestUrl: 'https://www.ntnu.no/studier/emner/TDT4136/2026',
  courseCode: 'TDT4136',
  evidenceKind: 'fixture' as const,
};
const dbhExamCapture = {
  retrievedAt: '2026-09-22T07:27:47.000Z',
  contentHash,
  requestUrl: 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData',
  courseCode: 'TDT4136',
  fromYear: 2022,
  toYear: 2025,
  evidenceKind: 'fixture' as const,
};
const batchCapture = {
  retrievedAt: '2026-07-24T12:00:00.000Z',
  contentHash,
  courseCodes: ['TDT4136', 'TDT4100', 'NORESULT'],
  fromYear: 2022,
  toYear: 2025,
  evidenceKind: 'fixture' as const,
};
const detailFixture = readFileSync(
  new URL('./ntnu/fixtures/tdt4136-detail.html', import.meta.url),
  'utf8',
);
const invalidAssessmentWeights = readFileSync(
  new URL('./ntnu/fixtures/invalid-assessment-weights.html', import.meta.url),
  'utf8',
);

const validSearchRow = {
  courseCode: 'TDT4136',
  courseVersion: '1',
  courseName: 'Introduction to Artificial Intelligence',
  examOnly: false,
  hasMultimedia: true,
  courseUrl: 'https://www.ntnu.no/studier/emner/TDT4136/2026',
  location: 'Trondheim',
};

const ordinaryAssessmentMarkup = `
  <html><body>
    <h1>TDT4136</h1>
    <h2>Vurderingsordning</h2><p>Samlet karakter</p>
    <div class="exam-element">
      <h4 class="course-exam-heading2">Ordinær eksamen - Høst 2026</h4>
      <h5 class="exam-form">Prosjektoppgave</h5>
      <span class="exam-fact-label">Vekting</span><span>60/100</span>
    </div>
    <div class="exam-element">
      <h4 class="course-exam-heading2">Ordinær eksamen - Høst 2026</h4>
      <h5 class="exam-form">Muntlig eksamen</h5>
      <span class="exam-fact-label">Vekting</span><span>40/100</span>
      <span class="exam-fact-label">Varighet</span><span>30 minutter</span>
    </div>
    <div class="exam-element">
      <h4 class="course-exam-heading2">Utsatt eksamen - Sommer 2027</h4>
      <h5 class="exam-form">Skriftlig skoleeksamen</h5>
      <span class="exam-fact-label">Vekting</span><span>100/100</span>
    </div>
  </body></html>
`;

describe('NTNU provider boundaries', () => {
  it.each([
    {
      name: 'captured catalogue data retains its exact course match',
      input: searchFixture,
      expectedRejected: 0,
    },
    {
      name: 'a malformed neighbouring catalogue row does not erase valid courses',
      input: {
        courses: [validSearchRow, { ...validSearchRow, courseName: '' }],
        numFound: 2,
        pageNr: 1,
        pageSize: 20,
        hasMoreResults: false,
      },
      expectedRejected: 1,
    },
  ])('$name', ({ input, expectedRejected }) => {
    const result = parseNtnuCourseSearch(input, searchCapture);

    expect(result.accepted.map((hit) => hit.courseCode)).toContain('TDT4136');
    expect(result.accepted.find((hit) => hit.courseCode === 'TDT4136')?.exactMatch).toBe(true);
    expect(result.rejected).toHaveLength(expectedRejected);
  });

  it.each([
    {
      name: 'invalid capture metadata',
      input: { courses: [] },
      capture: { ...searchCapture, requestUrl: 'https://untrusted.example/search' },
      code: 'invalid-capture-metadata',
    },
    {
      name: 'an invalid response shape',
      input: { courses: 'not-an-array' },
      capture: searchCapture,
      code: 'invalid-response-shape',
    },
  ])('rejects $name at the boundary', ({ input, capture, code }) => {
    const result = parseNtnuCourseSearch(input, capture);

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.code).toBe(code);
  });

  it.each([
    {
      name: 'the captured course page',
      input: detailFixture,
      contentState: 'known',
      credits: 7.5,
      assessmentState: undefined,
      assessmentParts: undefined,
    },
    {
      name: 'a page with only identity and credits',
      input: '<html><body><h1>TDT4136</h1><h2>Studiepoeng</h2><p>7.5</p></body></html>',
      contentState: 'unavailable',
      credits: 7.5,
      assessmentState: undefined,
      assessmentParts: undefined,
    },
    {
      name: 'ordinary components alongside a resit arrangement',
      input: ordinaryAssessmentMarkup,
      contentState: 'unavailable',
      credits: null,
      assessmentState: 'known',
      assessmentParts: {
        state: 'known',
        items: [
          { form: 'project', description: 'Prosjektoppgave', weightPercent: 60, duration: null },
          {
            form: 'oral-exam',
            description: 'Muntlig eksamen',
            weightPercent: 40,
            duration: '30 minutter',
          },
        ],
      },
    },
    {
      name: 'a page whose structured weights do not total 100 percent',
      input: invalidAssessmentWeights,
      contentState: 'unavailable',
      credits: null,
      assessmentState: 'unavailable',
      assessmentParts: undefined,
    },
  ])(
    'parses $name without fabricating unavailable facts',
    ({ input, contentState, credits, assessmentState, assessmentParts }) => {
      const result = parseNtnuCourseDetail(input, detailCapture);

      expect(result.rejected).toBeNull();
      const detail = result.accepted;
      if (detail === null) throw new Error('Expected valid NTNU detail fixture.');
      expect(detail).toMatchObject({
        content: { state: contentState },
        credits,
        ...(assessmentState === undefined ? {} : { assessmentParts: { state: assessmentState } }),
        ...(assessmentParts === undefined ? {} : { assessmentParts }),
      });
    },
  );

  it('retains observed NTNU work-form, collaboration, and attendance signals', () => {
    const result = parseNtnuCourseDetail(detailFixture, detailCapture);
    const detail = result.accepted;
    if (detail === null) throw new Error('Expected the captured NTNU detail page to parse.');

    expect(detail.teachingLanguage).toBe('English');
    expect(detail.assessmentFormGuesses).toContain('written-exam');
    expect(detail.workFormSignals).toEqual(expect.arrayContaining(['lectures', 'exercises']));
    expect(detail.collaborationSignal).toBe('mixed');
    expect(detail.attendanceSignal).toBe('not-required');
  });

  it.each([
    ['an empty response', '   ', 'empty-response'],
    [
      'a page for another course',
      '<html><body><h1>Page not found</h1></body></html>',
      'course-identity-mismatch',
    ],
  ])('rejects %s', (_name, input, code) => {
    const result = parseNtnuCourseDetail(input, detailCapture);

    expect(result.accepted).toBeNull();
    expect(result.rejected?.code).toBe(code);
  });

  it('keeps prose assessment forms and their uncertainty when NTNU weights are invalid', () => {
    const result = parseNtnuCourseDetail(invalidAssessmentWeights, detailCapture);
    const signals = mapNtnuDetailToCourseDecisionSignals(
      'TDT4136',
      2026,
      'autumn',
      result.accepted,
      null,
    );

    expect(signals.assessment).toMatchObject({ state: 'known' });
    if (signals.assessment.state !== 'known')
      throw new Error('Expected inferred assessment forms.');
    expect(signals.assessment.value.map((part) => part.form)).toEqual(['project', 'oral-exam']);
    expect(signals.assessment.value.map((part) => part.weightPercent.state)).toEqual([
      'unknown',
      'unknown',
    ]);
  });

  it('preserves valid generated catalogue rows when one controlled corruption is present', () => {
    const generatedSearchRow = fc.integer({ min: 100, max: 9_999 }).map((number) => ({
      courseCode: `TST${number}`,
      courseVersion: '1',
      courseName: `Course ${number}`,
      examOnly: false,
      hasMultimedia: false,
      courseUrl: `https://www.ntnu.no/studier/emner/TST${number}/2026`,
      location: 'Trondheim',
    }));

    fc.assert(
      fc.property(fc.array(generatedSearchRow, { minLength: 1, maxLength: 5 }), (rows) => {
        const first = rows[0];
        if (first === undefined) throw new Error('Expected a generated search row.');
        const result = parseNtnuCourseSearch(
          {
            courses: [...rows, { ...first, courseName: '' }],
            numFound: rows.length + 1,
            pageNr: 1,
            pageSize: 20,
            hasMoreResults: false,
          },
          searchCapture,
        );

        expect(result.accepted).toHaveLength(rows.length);
        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0]?.code).toBe('invalid-response-shape');
      }),
      { numRuns: 50, seed: 0x4e544e55 },
    );
  });
});

describe('grade provider boundaries', () => {
  it('preserves the captured DBH table-308 G and H buckets', () => {
    const result = parseDbhGradeSummaries(dbhFixture, {
      ...batchCapture,
      courseCodes: ['TDT4136'],
    });

    expect(result.rejected).toEqual([]);
    expect(result.accepted[0]?.rows).toEqual(
      expect.arrayContaining([
        { year: 2022, semester: 3, grade: 'G', candidateCount: 23 },
        { year: 2022, semester: 3, grade: 'H', candidateCount: 6 },
      ]),
    );
    const course = result.accepted[0];
    if (course === undefined) throw new Error('Expected the captured DBH course.');
    const outcomes = mapGradesToOutcomes('TDT4136', course);
    expect(outcomes.period).toMatchObject({
      state: 'known',
      value: { fromYear: 2022, toYear: 2025 },
    });
    expect(outcomes.sampleSize).toMatchObject({ state: 'known', value: 1799 });
  });

  it.each([
    {
      name: 'letter-scale evidence',
      rows: [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '2',
        },
      ],
      sampleState: 'known',
      sampleSize: 12,
      scale: 'letter',
    },
    {
      name: 'pass/fail evidence',
      rows: [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'G',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '8',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'H',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '2',
        },
      ],
      sampleState: 'known',
      sampleSize: 10,
      scale: 'pass-fail',
    },
    {
      name: 'mixed letter and pass/fail evidence',
      rows: [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'G',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '5',
        },
      ],
      sampleState: 'known',
      sampleSize: 15,
      scale: 'mixed',
    },
    {
      name: 'privacy-protected zero evidence',
      rows: [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '0',
        },
      ],
      sampleState: 'suppressed',
      sampleSize: undefined,
      scale: 'letter',
    },
  ])(
    'maps $name without treating protected values as known zeroes',
    ({ rows, sampleState, sampleSize, scale }) => {
      const parsed = parseDbhGradeSummaries(rows, batchCapture);
      const summary = mapDbhToGradeSummary('TDT4136', parsed.accepted[0] ?? null);

      expect(summary).toMatchObject({
        sampleSize: {
          state: sampleState,
          ...(sampleSize === undefined ? {} : { value: sampleSize }),
        },
        distribution: { state: sampleState },
        gradingScale: { state: 'known', value: scale },
      });
    },
  );

  it('retains accepted batch rows while classifying malformed, foreign, and stale rows', () => {
    const result = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '10',
        },
        {
          Emnekode: 'OTHER100-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '4',
        },
        {
          Emnekode: 'TDT4100-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': 'not-a-number',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'B',
          Årstall: '2026',
          Semester: '1',
          'Antall kandidater totalt': '4',
        },
      ],
      batchCapture,
    );

    expect(result.accepted.map((course) => course.courseCode)).toEqual(['TDT4136']);
    expect(result.rejected.map((rejection) => rejection.code)).toEqual([
      'row-course-unrequested',
      'row-schema-invalid',
      'row-period-unrequested',
    ]);
  });

  it('retains constrained DBH batch rows when a controlled neighbour is corrupt', () => {
    const generatedDbhBatchRow = fc.integer({ min: 100, max: 9_999 }).map((number) => ({
      courseCode: `TST${number}`,
      row: {
        Emnekode: `TST${number}-1`,
        Karakter: 'A',
        Årstall: '2024',
        Semester: '3',
        'Antall kandidater totalt': String(number),
      },
    }));

    fc.assert(
      fc.property(generatedDbhBatchRow, ({ courseCode, row }) => {
        const result = parseDbhGradeSummaries(
          [row, { ...row, 'Antall kandidater totalt': 'not-a-number' }],
          { ...batchCapture, courseCodes: [courseCode] },
        );

        expect(result.accepted.map((course) => course.courseCode)).toEqual([courseCode]);
        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0]?.code).toBe('row-schema-invalid');
      }),
      { numRuns: 50, seed: 0x44424842 },
    );
  });

  it('keeps DBH grade outcomes stable when source rows arrive in another order', () => {
    const capture = { ...batchCapture, courseCodes: ['TDT4136'] };
    const parsed = parseDbhGradeSummaries(dbhFixture, capture);
    const reordered = parseDbhGradeSummaries([...dbhFixture].reverse(), capture);
    const course = parsed.accepted[0];
    const reorderedCourse = reordered.accepted[0];
    if (course === undefined || reorderedCourse === undefined) {
      throw new Error('Expected valid DBH fixtures.');
    }

    const outcomes = mapGradesToOutcomes('TDT4136', course);
    const reorderedOutcomes = mapGradesToOutcomes('TDT4136', reorderedCourse);

    expect(reorderedOutcomes.sampleSize).toEqual(outcomes.sampleSize);
    expect(reorderedOutcomes.distribution).toEqual(outcomes.distribution);
    expect(reorderedOutcomes.failureRatePercent).toEqual(outcomes.failureRatePercent);
  });

  it('keeps missing and privacy-protected DBH grade data distinct from zero', () => {
    const unavailable = mapGradesToOutcomes('TDT4136', null);
    const protectedResult = parseDbhGradeSummaries(
      [
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'A',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '8',
        },
        {
          Emnekode: 'TDT4136-1',
          Karakter: 'F',
          Årstall: '2024',
          Semester: '3',
          'Antall kandidater totalt': '0',
        },
      ],
      { ...batchCapture, courseCodes: ['TDT4136'] },
    );
    const protectedCourse = protectedResult.accepted[0];
    if (protectedCourse === undefined) throw new Error('Expected valid DBH rows.');
    const protectedOutcomes = mapGradesToOutcomes('TDT4136', protectedCourse);

    expect(unavailable.sampleSize.state).toBe('unavailable');
    expect(protectedOutcomes.sampleSize.state).toBe('suppressed');
    expect(protectedOutcomes.failureRatePercent.state).toBe('suppressed');
  });

  it('maps official DBH table-905 participation and preserves protected cells', () => {
    const parsed = parseDbhExamOutcomes(dbhExamFixture, dbhExamCapture);
    if (parsed.accepted === null) throw new Error('Expected valid DBH table-905 fixture.');

    const participation = mapDbhToExamParticipation(parsed.accepted, parsed.rejected.length);

    expect(participation.period).toMatchObject({
      state: 'known',
      value: { fromYear: 2022, toYear: 2025 },
    });
    expect(participation.registered).toMatchObject({ state: 'known', value: 2248 });
    expect(participation.attended.state).toBe('suppressed');
    expect(participation.passed.state).toBe('suppressed');
    expect(participation.failed.state).toBe('suppressed');
    expect(participation.passedAfterRepeat.state).toBe('suppressed');
  });
});
