import { describe, expect, it } from 'vitest';

import {
  cloneScenario,
  decodeProgrammeVersion,
  decodeWorkbenchViewSpec,
  evaluateScenario,
  generateBaselineScenario,
  moveCourse,
  removeCourse,
  selectCourseForRequirement,
  restoreScenario,
  serializeScenario,
  totalPlannedCredits,
  type PlanningScenarioId,
} from './index';

const programme = decodeProgrammeVersion({
  id: 'no.ntnu:bit:2026',
  programmeId: 'no.ntnu:bit',
  institutionId: 'no.ntnu',
  institutionShortName: 'NTNU',
  title: 'Informatics — bachelor',
  cohortStartYear: 2026,
  startSeason: 'autumn',
  durationTerms: 4,
  dataRevision: 'fixture-planner-v1',
  relationAuthority: 'fixture',
  requirements: [
    {
      kind: 'required-course',
      id: 'required:intro',
      title: 'Programming foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4109:2026',
        code: 'TDT4109',
        title: 'Information Technology, Introduction',
        credits: 7.5,
        recommendedTermIndex: 0,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'required-course',
      id: 'required:algorithms',
      title: 'Algorithms foundation',
      course: {
        courseVersionId: 'no.ntnu:TDT4120:2026',
        code: 'TDT4120',
        title: 'Algorithms and Data Structures',
        credits: 7.5,
        recommendedTermIndex: 1,
      },
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'choose-n',
      id: 'choice:systems',
      title: 'Choose one systems elective',
      choose: 1,
      options: [
        {
          courseVersionId: 'no.ntnu:TDT4258:2026',
          code: 'TDT4258',
          title: 'Low-Level Programming',
          credits: 7.5,
          recommendedTermIndex: 3,
        },
      ],
      defaultCourseVersionIds: ['no.ntnu:TDT4258:2026'],
      evidenceRefs: ['fixture:programme-roadmap'],
    },
    {
      kind: 'minimum-credits',
      id: 'credits:partial-roadmap',
      title: 'Partial roadmap credits',
      minimumCredits: 22.5,
      eligibleCourseVersionIds: [],
      evidenceRefs: ['fixture:programme-roadmap'],
    },
  ],
});

const baseline = () =>
  generateBaselineScenario(programme, {
    id: 'scenario:baseline' as PlanningScenarioId,
    title: 'Baseline',
  });

describe('study planning kernel', () => {
  it('generates a deterministic baseline roadmap', () => {
    const scenario = baseline();

    expect(scenario.terms).toHaveLength(4);
    expect(scenario.terms[0]?.courses.map((course) => course.code)).toEqual(['TDT4109']);
    expect(scenario.terms[1]?.courses.map((course) => course.code)).toEqual(['TDT4120']);
    expect(scenario.terms[3]?.courses.map((course) => course.code)).toEqual(['TDT4258']);
    expect(totalPlannedCredits(scenario)).toBe(22.5);
  });

  it('moves a course and reports the recommendation deviation', () => {
    const scenario = baseline();
    const moved = moveCourse(scenario, 'no.ntnu:TDT4120:2026', 'term:3');

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    const evaluation = evaluateScenario(programme, moved.value, {
      maximumCreditsPerTerm: 30,
    });
    expect(evaluation.findings.some((finding) => finding.code === 'recommended-term-changed')).toBe(
      true,
    );
    expect(evaluation.isFeasible).toBe(true);
  });

  it('reports missing formal requirements after removal', () => {
    const removed = removeCourse(baseline(), 'no.ntnu:TDT4109:2026');
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;

    const evaluation = evaluateScenario(programme, removed.value, {
      maximumCreditsPerTerm: 30,
    });
    expect(evaluation.isFeasible).toBe(false);
    expect(evaluation.findings.map((finding) => finding.code)).toContain('required-course-missing');
  });

  it('replaces an elective choice without duplicating its requirement group', () => {
    const scenario = baseline();
    const changed = selectCourseForRequirement(
      programme,
      scenario,
      'choice:systems',
      'no.ntnu:TDT4258:2026',
      'term:2',
    );

    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    const matching = changed.value.terms.flatMap((term) =>
      term.courses.filter((course) => course.requirementGroupId === 'choice:systems'),
    );
    expect(matching).toHaveLength(1);
    expect(matching[0]?.courseVersionId).toBe('no.ntnu:TDT4258:2026');
  });

  it('validates a declarative roadmap workbench view', () => {
    const view = decodeWorkbenchViewSpec({
      schemaVersion: 1,
      id: 'view:test-roadmap',
      title: 'Test roadmap',
      entity: 'planning-scenario',
      filters: [],
      relationTraversal: ['scenario.programmeVersion'],
      groupBy: ['terms.term.index'],
      sort: [{ field: 'terms.term.index', direction: 'ascending' }],
      fields: ['terms.term.label', 'terms.courses.code'],
      presentation: 'roadmap',
      parameters: [],
    });

    expect(view.presentation).toBe('roadmap');
    expect(view.groupBy).toEqual(['terms.term.index']);
  });

  it('round-trips a scenario through its portable representation', () => {
    const scenario = cloneScenario(
      baseline(),
      'scenario:alternative' as PlanningScenarioId,
      'Alternative',
    );

    expect(restoreScenario(serializeScenario(scenario))).toEqual(scenario);
  });
});
