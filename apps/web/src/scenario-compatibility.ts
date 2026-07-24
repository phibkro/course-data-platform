import type { ProgrammeSummaryDtoType } from '@course-data/contracts';
import type { PlanningScenario } from '@course-data/study-kernel';

export interface ScenarioCompatibilityIssue {
  readonly scenarioId: string;
  readonly scenarioTitle: string;
  readonly programmeVersionId: string;
  readonly dataRevision: string;
  readonly reason: 'programme-version-unavailable' | 'data-revision-unavailable';
}

export const findScenarioCompatibilityIssues = (
  scenarios: ReadonlyArray<PlanningScenario>,
  programmes: ReadonlyArray<ProgrammeSummaryDtoType>,
): ReadonlyArray<ScenarioCompatibilityIssue> => {
  const currentRevisionByVersion = new Map(
    programmes.map((programme) => [programme.programmeVersionId, programme.dataRevision]),
  );
  return scenarios.flatMap((scenario): ReadonlyArray<ScenarioCompatibilityIssue> => {
    const currentRevision = currentRevisionByVersion.get(scenario.programmeVersionId);
    if (currentRevision === undefined) {
      return [
        {
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          programmeVersionId: scenario.programmeVersionId,
          dataRevision: scenario.dataRevision,
          reason: 'programme-version-unavailable' as const,
        },
      ];
    }
    return currentRevision === scenario.dataRevision
      ? []
      : [
          {
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            programmeVersionId: scenario.programmeVersionId,
            dataRevision: scenario.dataRevision,
            reason: 'data-revision-unavailable' as const,
          },
        ];
  });
};
