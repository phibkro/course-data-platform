import { decodePlanningScenario } from '@course-data/study-kernel';
import { describe, expect, it } from 'vitest';

import { findScenarioCompatibilityIssues } from './scenario-compatibility';

const scenario = decodePlanningScenario({
  schemaVersion: 1,
  id: 'scenario:old',
  title: 'Saved old roadmap',
  programmeVersionId: 'no.ntnu:bit:2026',
  dataRevision: 'fixture-planner-v1',
  completedCourseVersionIds: [],
  terms: [],
});

const currentProgramme = {
  programmeId: 'no.ntnu:BIT',
  programmeVersionId: 'no.ntnu:BIT:2024:1ec3714cdc3af3dd',
  institutionId: 'no.ntnu',
  institutionShortName: 'NTNU',
  title: 'Informatikk - bachelor',
  cohortStartYear: 2024,
  startSeason: 'autumn' as const,
  durationTerms: 6,
  relationAuthority: 'official' as const,
  dataRevision: 'ntnu:1ec3714cdc3af3dd',
  observedAt: '2026-07-22T02:20:39Z',
  sourcePeriod: '2024',
};

describe('saved scenario compatibility', () => {
  it('reports an absent programme version without dropping the scenario', () => {
    expect(findScenarioCompatibilityIssues([scenario], [currentProgramme])).toEqual([
      expect.objectContaining({
        scenarioId: scenario.id,
        reason: 'programme-version-unavailable',
        dataRevision: 'fixture-planner-v1',
      }),
    ]);
  });

  it('reports a changed revision for the same programme version', () => {
    const sameVersion = { ...currentProgramme, programmeVersionId: scenario.programmeVersionId };
    expect(findScenarioCompatibilityIssues([scenario], [sameVersion])).toEqual([
      expect.objectContaining({ reason: 'data-revision-unavailable' }),
    ]);
  });
});
