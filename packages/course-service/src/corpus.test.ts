import { describe, expect, it } from 'vitest';

import {
  corpusCourseSearchItems,
  corpusCoursesInsights,
  corpusDecisionSignalsFor,
  corpusGradeSummaryFor,
} from './corpus';

const insightByCode = (code: string) => {
  const insight = corpusCoursesInsights.find((item) => item.code === code);
  expect(insight).toBeDefined();
  return insight!;
};

describe('assessment golden corpus', () => {
  it('stays inside the contract band of 10–20 courses', () => {
    expect(corpusCoursesInsights.length).toBeGreaterThanOrEqual(10);
    expect(corpusCoursesInsights.length).toBeLessThanOrEqual(20);
    expect(corpusCourseSearchItems).toHaveLength(corpusCoursesInsights.length);
  });

  it('carries fixture-kind evidence with the NTNU page URL and a retrieval date for every entry', () => {
    for (const insight of corpusCoursesInsights) {
      const pageEvidence = insight.evidence.find((evidence) =>
        evidence.sourceUrl?.startsWith('https://www.ntnu.edu/studies/courses/'),
      );
      expect(pageEvidence, `${insight.code} page evidence`).toBeDefined();
      expect(pageEvidence?.kind).toBe('fixture');
      expect(pageEvidence?.observedAt).toBeInstanceOf(Date);
      expect(insight.sourceStatuses.some((status) => status.status === 'available')).toBe(true);
    }
  });

  it('signals an oral exam for at least one course (TET4180)', () => {
    const signals = corpusDecisionSignalsFor('TET4180');
    expect(signals).not.toBeNull();
    expect(signals!.assessment).toMatchObject({ state: 'known' });
    expect(
      signals!.assessment.state === 'known' &&
        signals!.assessment.value.some((part) => part.form === 'oral-exam'),
    ).toBe(true);
  });

  it('keeps the ambiguity rows decodable: TET4180 mixes oral and portfolio; TDT4501 collaboration stays unknown', () => {
    const tet4180 = insightByCode('TET4180');
    const forms =
      tet4180.assessment.state === 'known' ? tet4180.assessment.value.map((part) => part.form) : [];
    expect(forms).toContain('oral-exam');
    expect(forms).toContain('portfolio');

    const tdt4501 = insightByCode('TDT4501');
    expect(tdt4501.collaboration.state).toBe('unknown');
  });

  it('encodes IT1901 attendance as known-required and ENG6024 online participation as known-available', () => {
    const it1901 = insightByCode('IT1901');
    expect(it1901.attendance).toMatchObject({ state: 'known', value: 'required' });

    const eng6024 = insightByCode('ENG6024');
    expect(eng6024.onlineParticipation).toMatchObject({ state: 'known', value: 'available' });
  });

  it('covers high and low observed failure rates: TDT4250 exceeds TDT4109', () => {
    const tdt4250 = corpusGradeSummaryFor('tdt4250');
    const tdt4109 = corpusGradeSummaryFor('tdt4109');
    expect(tdt4250?.failureRatePercent).toMatchObject({ state: 'known' });
    expect(tdt4109?.failureRatePercent).toMatchObject({ state: 'known' });
    expect(tdt4250!.failureRatePercent.value).toBeGreaterThan(tdt4109!.failureRatePercent.value);
  });

  it('leaves grade statistics explicitly unavailable where no observation was fetched', () => {
    const unavailableCount = corpusCoursesInsights.filter(
      (insight) =>
        insight.gradeOutcomes.sampleSize.state === 'unavailable' &&
        insight.gradeOutcomes.failureRatePercent.state === 'unavailable',
    ).length;
    expect(unavailableCount).toBeGreaterThanOrEqual(3);
    expect(corpusGradeSummaryFor('ENG6024')).toBeNull();
  });

  it('answers case-insensitive summary lookups with positive sample sizes for DBH-backed codes only', () => {
    for (const code of ['tdt4109', 'IT1901', 'Tdt4290']) {
      const summary = corpusGradeSummaryFor(code);
      expect(summary).not.toBeNull();
      expect(summary!.sampleSize).toMatchObject({ state: 'known' });
      expect(summary!.sampleSize.value).toBeGreaterThan(0);
    }
    expect(corpusGradeSummaryFor('NOSUCH01')).toBeNull();
  });
});
