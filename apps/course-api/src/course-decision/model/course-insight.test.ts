import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { decodeCourseDecisionSignals, known, validateEvidenceReferences } from './course-insight';

const evidence = {
  id: 'evidence:ntnu-course-page:TDT4136:2026-autumn',
  provider: 'ntnu-course-page',
  kind: 'source-fact' as const,
  recordId: 'TDT4136:2026-autumn',
  sourceUrl: 'https://www.ntnu.no/studier/emner/TDT4136/2026',
  sourcePeriod: '2026/2027 · autumn',
  observedAt: '2026-07-24T12:00:00.000Z',
  excerpt: null,
  inferenceRule: null,
};

const attributed = (value: unknown) => ({
  state: 'known' as const,
  value,
  evidenceIds: [evidence.id],
});

const makeDecisionSignals = (overrides: Record<string, unknown> = {}) => ({
  courseCode: 'TDT4136',
  credits: attributed(7.5),
  assessment: attributed([]),
  workFormSignals: attributed([]),
  obligatoryActivities: attributed([]),
  collaboration: attributed('group'),
  attendance: attributed('required'),
  onlineParticipation: attributed('available'),
  sourceStatus: {
    provider: 'ntnu-course-page',
    status: 'available' as const,
    observedAt: evidence.observedAt,
    warning: null,
  },
  evidence: [evidence],
  ...overrides,
});

type EncodedFact =
  | {
      readonly state: 'known';
      readonly value: unknown;
      readonly evidenceIds: ReadonlyArray<string>;
    }
  | {
      readonly state: 'unknown' | 'unavailable' | 'suppressed';
      readonly reason: string;
      readonly evidenceIds: ReadonlyArray<string>;
    }
  | {
      readonly state: 'conflicting';
      readonly reason: string;
      readonly candidates: ReadonlyArray<{
        readonly value: unknown;
        readonly evidenceIds: ReadonlyArray<string>;
      }>;
      readonly evidenceIds: ReadonlyArray<string>;
    };

const reason = fc.string({ minLength: 1, maxLength: 80 });

const fact = (value: unknown): fc.Arbitrary<EncodedFact> =>
  fc.oneof(
    fc.constant(attributed(value)),
    fc
      .constantFrom('unknown' as const, 'unavailable' as const, 'suppressed' as const)
      .chain((state) => reason.map((message) => ({ state, reason: message, evidenceIds: [] }))),
    reason.map((message) => ({
      state: 'conflicting' as const,
      reason: message,
      candidates: [
        { value, evidenceIds: [evidence.id] },
        { value, evidenceIds: [evidence.id] },
      ],
      evidenceIds: [evidence.id],
    })),
  );

describe('course decision fact and evidence contracts', () => {
  it('round-trips every factual state without losing its evidence semantics', () => {
    fc.assert(
      fc.property(
        fact(7.5),
        fact([]),
        fact([]),
        fact([]),
        fact('group'),
        fact('required'),
        fact('available'),
        (
          credits,
          assessment,
          workFormSignals,
          obligatoryActivities,
          collaboration,
          attendance,
          onlineParticipation,
        ) => {
          const decoded = decodeCourseDecisionSignals(
            makeDecisionSignals({
              credits,
              assessment,
              workFormSignals,
              obligatoryActivities,
              collaboration,
              attendance,
              onlineParticipation,
            }),
          );
          const inputFacts = [
            credits,
            assessment,
            workFormSignals,
            obligatoryActivities,
            collaboration,
            attendance,
            onlineParticipation,
          ];
          const outputFacts = [
            decoded.credits,
            decoded.assessment,
            decoded.workFormSignals,
            decoded.obligatoryActivities,
            decoded.collaboration,
            decoded.attendance,
            decoded.onlineParticipation,
          ];

          expect(validateEvidenceReferences(decoded)).toEqual([]);
          for (const [input, output] of inputFacts.map(
            (input, index) => [input, outputFacts[index]] as const,
          )) {
            expect({
              state: output?.state,
              evidenceIds: output?.evidenceIds,
              hasValue: output !== undefined && 'value' in output,
            }).toEqual({
              state: input.state,
              evidenceIds: input.evidenceIds,
              hasValue: input.state === 'known',
            });
          }
        },
      ),
      { numRuns: 60, seed: 0x46414354 },
    );
  });

  it('rejects every generated orphan evidence reference', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (suffix) => {
        const orphanId = `orphan-evidence-${suffix}`;

        expect(() =>
          decodeCourseDecisionSignals(
            makeDecisionSignals({
              credits: { state: 'known', value: 7.5, evidenceIds: [orphanId] },
            }),
          ),
        ).toThrow(orphanId);
      }),
      { numRuns: 50, seed: 0x45564944 },
    );
  });

  it('rejects an optional activity represented as a weighted assessment contribution', () => {
    expect(() =>
      decodeCourseDecisionSignals(
        makeDecisionSignals({
          assessment: known(
            [
              {
                form: 'project',
                description: 'Optional project',
                requirement: known('optional', [evidence.id]),
                weightPercent: known(25, [evidence.id]),
                duration: {
                  state: 'unknown',
                  reason: 'The provider did not publish a duration.',
                  evidenceIds: [],
                },
                workloadPattern: {
                  state: 'unknown',
                  reason: 'The provider did not publish a workload pattern.',
                  evidenceIds: [],
                },
              },
            ],
            [evidence.id],
          ),
        }),
      ),
    ).toThrow('An optional course-work item cannot contribute to the final grade.');
  });
});
