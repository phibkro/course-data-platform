import {
  decodeProgrammeVersion,
  generateBaselineScenario,
  type PlanningScenarioId,
} from '@course-data/study-kernel';
import { describe, expect, it } from 'vitest';

import { restoreScenarioEnvelope, serializeScenarioEnvelope } from './scenario-repository';

const programme = decodeProgrammeVersion({
  id: 'no.test:programme:2026',
  programmeId: 'no.test:programme',
  institutionId: 'no.test',
  institutionShortName: 'TEST',
  title: 'Test programme',
  cohortStartYear: 2026,
  startSeason: 'autumn',
  durationTerms: 2,
  dataRevision: 'test-revision',
  relationAuthority: 'fixture',
  requirements: [],
});

const scenario = generateBaselineScenario(programme, {
  id: 'scenario:portable' as PlanningScenarioId,
  title: 'Portable scenario',
});

describe('planning scenario export', () => {
  it('round-trips a portable scenario envelope', () => {
    const serialized = serializeScenarioEnvelope(scenario, '2026-07-20T20:00:00.000Z');
    expect(restoreScenarioEnvelope(serialized)).toEqual(scenario);
  });

  it('rejects unrelated JSON documents', () => {
    expect(() => restoreScenarioEnvelope('{"hello":"world"}')).toThrow(
      'not a Course Data Platform planning scenario',
    );
  });
});
