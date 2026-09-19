import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseNtnuCourseDetail } from './detail';
import { mapNtnuDetailToCourseDecisionSignals } from './map-course-decision-signals';

const capture = {
  retrievedAt: '2026-07-24T12:00:00.000Z',
  contentHash: '0'.repeat(64),
  requestUrl: 'https://www.ntnu.no/studier/emner/TPD4114/2026',
  courseCode: 'TPD4114',
  evidenceKind: 'fixture' as const,
};

describe('mapNtnuDetailToCourseDecisionSignals', () => {
  it('retains prose forms and the source reason for rejected structured weights', () => {
    const parsed = parseNtnuCourseDetail(
      readFileSync(new URL('../fixtures/invalid-assessment-weights.html', import.meta.url), 'utf8'),
      { ...capture, courseCode: 'TDT4136' },
    );
    const signals = mapNtnuDetailToCourseDecisionSignals(
      'TDT4136',
      2026,
      'autumn',
      parsed.accepted,
      null,
    );
    expect(signals.assessment.state).toBe('known');
    if (signals.assessment.state !== 'known') throw new Error('Expected supported prose forms');
    expect(signals.assessment.value.map((part) => part.form)).toEqual(['project', 'oral-exam']);
    for (const part of signals.assessment.value) {
      expect(part.weightPercent).toMatchObject({
        state: 'unknown',
        reason: 'Structured ordinary assessment weights total 120%, not 100%.',
      });
      expect(part.weightPercent.evidenceIds).toEqual([
        signals.evidence.find((evidence) => evidence.kind === 'fixture')!.id,
      ]);
    }
    expect(signals.assessment.evidenceIds).toEqual([
      signals.evidence.find((evidence) => evidence.kind === 'inference')!.id,
    ]);
  });
  it('attributes assessment, obligatory-work, and collaboration inferences', () => {
    const parsed = parseNtnuCourseDetail(
      `
        <html><body>
          <h1>TPD4114</h1>
          <p>Studiepoeng 7,5</p>
          <h2>Læringsformer og aktiviteter</h2>
          <p>Forelesninger og prosjektarbeid i grupper.</p>
          <h2>Vurderingsordning</h2>
          <p>Prosjektrapport og muntlig eksamen.</p>
          <h2>Obligatoriske aktiviteter</h2>
          <p>Godkjent prosjektpresentasjon.</p>
          <div class="exam-element">
            <h4 class="course-exam-heading2">Ordinær eksamen - Høst 2026</h4>
            <h5 class="exam-form">Prosjektrapport</h5>
            <span class="exam-fact-label">Vekting</span><span>60/100</span>
          </div>
          <div class="exam-element">
            <h4 class="course-exam-heading2">Ordinær eksamen - Høst 2026</h4>
            <h5 class="exam-form">Muntlig eksamen</h5>
            <span class="exam-fact-label">Vekting</span><span>40/100</span>
            <span class="exam-fact-label">Varighet</span><span>30 minutter</span>
            <span class="exam-fact-label">Eksamenssystem</span><span>Inspera</span>
          </div>
        </body></html>
      `,
      capture,
    );

    const signals = mapNtnuDetailToCourseDecisionSignals(
      'TPD4114',
      2026,
      'autumn',
      parsed.accepted,
      null,
    );

    expect(signals.assessment).toMatchObject({
      state: 'known',
      value: [
        { form: 'project', weightPercent: { state: 'known', value: 60 } },
        {
          form: 'oral-exam',
          weightPercent: { state: 'known', value: 40 },
          duration: { state: 'known', value: '30 minutter' },
        },
      ],
    });
    expect(signals.credits).toMatchObject({ state: 'known', value: 7.5 });
    expect(signals.obligatoryActivities).toMatchObject({ state: 'known' });
    expect(signals.collaboration).toMatchObject({ state: 'known', value: 'group' });
    expect(signals.workFormSignals).toMatchObject({
      state: 'known',
      value: expect.arrayContaining(['lectures', 'project']),
    });
    expect(signals.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'fixture' }),
        expect.objectContaining({ kind: 'inference' }),
      ]),
    );
  });

  it('keeps every signal unavailable when the detail source failed', () => {
    const signals = mapNtnuDetailToCourseDecisionSignals(
      'TPD4114',
      2026,
      'autumn',
      null,
      'NTNU returned HTTP 503.',
    );

    expect(signals.credits.state).toBe('unavailable');
    expect(signals.assessment.state).toBe('unavailable');
    expect(signals.obligatoryActivities.state).toBe('unavailable');
    expect(signals.sourceStatus).toMatchObject({
      status: 'failed',
      warning: 'NTNU returned HTTP 503.',
    });
    expect(signals.evidence).toEqual([]);
  });
});
