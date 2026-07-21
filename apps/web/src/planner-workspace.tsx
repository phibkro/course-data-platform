import type {
  ListProgrammesResponseDtoType,
  PlannerDemoResponseDtoType,
} from '@course-data/contracts';
import {
  cloneScenario,
  decodePlanningScenario,
  decodeProgrammeVersion,
  decodeWorkbenchViewSpec,
  evaluateScenario,
  listCourseOptions,
  moveCourse,
  placeCourse,
  removeCourse,
  renameScenario,
  selectCourseForRequirement,
  type PlanningScenario,
  type PlanningScenarioId,
  type ProgrammeVersion,
  type ScenarioEvaluation,
  type WorkbenchViewSpec,
} from '@course-data/study-kernel';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { api } from './api';
import {
  clearPlannerData,
  deleteScenario,
  listScenarios,
  loadPlannerPreferences,
  restoreScenarioEnvelope,
  savePlannerPreferences,
  saveScenario,
  serializeScenarioEnvelope,
} from './scenario-repository';

const evaluationPolicy = { maximumCreditsPerTerm: 30 } as const;
type PlannerMode = 'plan' | 'workbench';

type PlannerProjection = {
  readonly programme: ProgrammeVersion;
  readonly baseline: PlanningScenario;
  readonly viewSpec: WorkbenchViewSpec;
  readonly note: string;
};

const errorMessage = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) return 'Request failed';
  if ('detail' in value && typeof value.detail === 'string') return value.detail;
  if ('message' in value && typeof value.message === 'string') return value.message;
  return 'Request failed';
};

const kernelErrorMessage = (error: { readonly _tag: string }): string => {
  switch (error._tag) {
    case 'UnknownCourse':
      return 'The selected course is no longer part of this programme version.';
    case 'UnknownTerm':
      return 'The selected study term does not exist.';
    case 'CourseAlreadyPlaced':
      return 'That course is already placed in the scenario.';
    case 'CourseNotPlaced':
      return 'That course is not currently placed in the scenario.';
    case 'UnknownRequirement':
      return 'The selected requirement group does not exist.';
    case 'InvalidRequirementOption':
      return 'That course does not satisfy the selected requirement group.';
    default:
      return 'The planning operation could not be applied.';
  }
};

const decodeProjection = (response: PlannerDemoResponseDtoType): PlannerProjection => ({
  programme: decodeProgrammeVersion(response.programme),
  baseline: decodePlanningScenario(response.scenario),
  viewSpec: decodeWorkbenchViewSpec(response.viewSpec),
  note: response.meta.note,
});

function ProgrammeOnboarding({
  programmes,
  onSelect,
}: {
  readonly programmes: ListProgrammesResponseDtoType;
  readonly onSelect: (programmeVersionId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase();
  const visible = programmes.items.filter((programme) => {
    if (!normalized) return true;
    return (
      programme.title.toLocaleLowerCase().includes(normalized) ||
      programme.institutionShortName.toLocaleLowerCase().includes(normalized) ||
      String(programme.cohortStartYear).includes(normalized)
    );
  });

  return (
    <section className="onboarding" aria-labelledby="programme-onboarding-heading">
      <div className="onboarding__intro">
        <p className="section-label">Start a roadmap</p>
        <h2 id="programme-onboarding-heading">What are you studying or considering?</h2>
        <p>
          Choose a programme and cohort. The planner will generate a baseline scenario which stays
          local to this browser.
        </p>
      </div>
      <label className="search-field">
        <span>Programme, institution, or cohort</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Try informatics or NTNU"
          autoComplete="off"
        />
      </label>
      <div className="programme-list">
        {visible.map((programme) => (
          <article className="programme-option" key={programme.programmeVersionId}>
            <div>
              <span className="authority-badge">{programme.relationAuthority}</span>
              <h3>{programme.title}</h3>
              <p>
                {programme.institutionShortName} · Cohort {programme.cohortStartYear} ·{' '}
                {programme.durationTerms} terms
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => onSelect(programme.programmeVersionId)}
            >
              Plan this programme
            </button>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="state">No programme in the current bounded dataset matches that search.</p>
      )}
    </section>
  );
}

function ScenarioToolbar({
  scenarios,
  activeScenario,
  onSelect,
  onRename,
  onClone,
  onReset,
  onExport,
  onImport,
  onDelete,
}: {
  readonly scenarios: ReadonlyArray<PlanningScenario>;
  readonly activeScenario: PlanningScenario;
  readonly onSelect: (scenarioId: string) => void;
  readonly onRename: (title: string) => void;
  readonly onClone: () => void;
  readonly onReset: () => void;
  readonly onExport: () => void;
  readonly onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDelete: () => void;
}) {
  return (
    <section className="scenario-toolbar" aria-label="Planning scenario controls">
      <label>
        <span>Scenario</span>
        <select value={activeScenario.id} onChange={(event) => onSelect(event.target.value)}>
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.title}
            </option>
          ))}
        </select>
      </label>
      <label className="scenario-title-field">
        <span>Name</span>
        <input
          value={activeScenario.title}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Scenario name"
        />
      </label>
      <div className="toolbar-actions">
        <button type="button" onClick={onClone}>
          Clone
        </button>
        <button type="button" onClick={onReset}>
          Reset baseline
        </button>
        <button type="button" onClick={onExport}>
          Export
        </button>
        <label className="file-button">
          Import
          <input type="file" accept="application/json,.json" onChange={onImport} />
        </label>
        <button type="button" onClick={onDelete} disabled={scenarios.length === 1}>
          Delete
        </button>
      </div>
    </section>
  );
}

function RoadmapEditor({
  scenario,
  evaluation,
  onMove,
  onRemove,
}: {
  readonly scenario: PlanningScenario;
  readonly evaluation: ScenarioEvaluation;
  readonly onMove: (courseVersionId: string, targetTermId: string) => void;
  readonly onRemove: (courseVersionId: string) => void;
}) {
  return (
    <div className="roadmap" aria-label="Term-by-term roadmap">
      {scenario.terms.map(({ term, courses }) => (
        <article className="term-card" key={term.id}>
          <div className="term-card__header">
            <div>
              <span>Term {term.index + 1}</span>
              <h3>{term.label}</h3>
            </div>
            <strong>{evaluation.termCredits[term.id] ?? 0} credits</strong>
          </div>
          {courses.length === 0 ? (
            <p className="empty-term">No course is currently placed in this term.</p>
          ) : (
            <ul className="planned-courses">
              {courses.map((course) => (
                <li key={course.courseVersionId}>
                  <span>{course.code}</span>
                  <div className="planned-course__body">
                    <strong>{course.title}</strong>
                    <small>{course.credits} credits</small>
                    <div className="planned-course__actions">
                      <label>
                        <span className="visually-hidden">Move {course.code} to</span>
                        <select
                          value={term.id}
                          onChange={(event) => onMove(course.courseVersionId, event.target.value)}
                        >
                          {scenario.terms.map((candidate) => (
                            <option key={candidate.term.id} value={candidate.term.id}>
                              {candidate.term.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemove(course.courseVersionId)}
                        aria-label={`Remove ${course.code} from this scenario`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

function CourseAndRequirementControls({
  programme,
  scenario,
  onPlace,
  onSelectChoice,
}: {
  readonly programme: ProgrammeVersion;
  readonly scenario: PlanningScenario;
  readonly onPlace: (courseVersionId: string, targetTermId: string) => void;
  readonly onSelectChoice: (
    requirementGroupId: string,
    courseVersionId: string,
    targetTermId: string,
  ) => void;
}) {
  const placed = new Set(
    scenario.terms.flatMap((term) => term.courses.map((course) => course.courseVersionId)),
  );
  const unplaced = listCourseOptions(programme).filter(
    (course) => !placed.has(course.courseVersionId),
  );
  const [courseVersionId, setCourseVersionId] = useState(unplaced[0]?.courseVersionId ?? '');
  const [termId, setTermId] = useState(scenario.terms[0]?.term.id ?? '');

  useEffect(() => {
    if (!unplaced.some((course) => course.courseVersionId === courseVersionId)) {
      setCourseVersionId(unplaced[0]?.courseVersionId ?? '');
    }
  }, [courseVersionId, unplaced]);

  return (
    <section className="planner-controls" aria-labelledby="planner-controls-heading">
      <div>
        <p className="section-label">Scenario operations</p>
        <h3 id="planner-controls-heading">Adjust the roadmap</h3>
      </div>

      <div className="control-grid">
        <div className="control-card">
          <h4>Add an unplaced programme course</h4>
          {unplaced.length === 0 ? (
            <p>Every known programme course is placed.</p>
          ) : (
            <>
              <label>
                <span>Course</span>
                <select
                  value={courseVersionId}
                  onChange={(event) => setCourseVersionId(event.target.value)}
                >
                  {unplaced.map((course) => (
                    <option key={course.courseVersionId} value={course.courseVersionId}>
                      {course.code} — {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Term</span>
                <select value={termId} onChange={(event) => setTermId(event.target.value)}>
                  {scenario.terms.map((term) => (
                    <option key={term.term.id} value={term.term.id}>
                      {term.term.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary-button"
                type="button"
                disabled={!courseVersionId || !termId}
                onClick={() => onPlace(courseVersionId, termId)}
              >
                Add course
              </button>
            </>
          )}
        </div>

        {programme.requirements
          .filter((requirement) => requirement.kind === 'choose-n')
          .map((requirement) => {
            const selected = requirement.options.find((option) =>
              placed.has(option.courseVersionId),
            );
            const placement = scenario.terms.find((candidate) =>
              candidate.courses.some(
                (course) => course.courseVersionId === selected?.courseVersionId,
              ),
            );
            const selectedTermId =
              placement?.term.id ??
              scenario.terms[requirement.options[0]?.recommendedTermIndex ?? 0]?.term.id ??
              scenario.terms[0]?.term.id ??
              '';

            return (
              <div className="control-card" key={requirement.id}>
                <h4>{requirement.title}</h4>
                <p>
                  Choose {requirement.choose}. Changing this selection replaces the current option.
                </p>
                <label>
                  <span>Selected course</span>
                  <select
                    value={selected?.courseVersionId ?? ''}
                    onChange={(event) =>
                      onSelectChoice(requirement.id, event.target.value, selectedTermId)
                    }
                  >
                    <option value="" disabled>
                      Select a course
                    </option>
                    {requirement.options.map((option) => (
                      <option key={option.courseVersionId} value={option.courseVersionId}>
                        {option.code} — {option.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
      </div>
    </section>
  );
}

function EvaluationPanel({ evaluation }: { readonly evaluation: ScenarioEvaluation }) {
  return (
    <div className="evaluation-panel">
      <div>
        <p className="section-label">Kernel evaluation</p>
        <h2>{evaluation.isFeasible ? 'No blocking findings' : 'Roadmap needs attention'}</h2>
      </div>
      {evaluation.findings.length === 0 ? (
        <p>The current fixture satisfies its partial requirement model.</p>
      ) : (
        <ul>
          {evaluation.findings.map((finding, index) => (
            <li key={`${finding.code}:${finding.courseVersionId ?? finding.termId ?? index}`}>
              <strong>{finding.title}</strong>
              <span>{finding.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlannerWorkspace({ mode }: { readonly mode: PlannerMode }) {
  const programmes = useQuery<ListProgrammesResponseDtoType>({
    queryKey: ['programmes'],
    queryFn: async () => {
      const result = await api.v1.programmes.get();
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as ListProgrammesResponseDtoType;
    },
  });

  const [selectedProgrammeVersionId, setSelectedProgrammeVersionId] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ReadonlyArray<PlanningScenario>>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const loadedProgrammeRef = useRef<string | null>(null);

  useEffect(() => {
    loadPlannerPreferences()
      .then((preferences) => {
        setSelectedProgrammeVersionId(preferences.selectedProgrammeVersionId);
        setActiveScenarioId(preferences.activeScenarioId);
      })
      .catch((error: unknown) => setOperationMessage(errorMessage(error)))
      .finally(() => setStorageReady(true));
  }, []);

  const baseline = useQuery<PlannerDemoResponseDtoType>({
    queryKey: ['planner-baseline', selectedProgrammeVersionId],
    enabled: selectedProgrammeVersionId !== null,
    queryFn: async () => {
      const result = await api.v1.planner.baseline.get({
        query: { programmeVersionId: selectedProgrammeVersionId ?? '' },
      });
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as PlannerDemoResponseDtoType;
    },
  });

  const projection = useMemo(
    () => (baseline.data ? decodeProjection(baseline.data) : null),
    [baseline.data],
  );

  useEffect(() => {
    if (!storageReady || !projection || !selectedProgrammeVersionId) return;
    if (loadedProgrammeRef.current === selectedProgrammeVersionId) return;
    loadedProgrammeRef.current = selectedProgrammeVersionId;

    listScenarios(selectedProgrammeVersionId)
      .then(async (stored) => {
        const next = stored.length > 0 ? stored : [projection.baseline];
        if (stored.length === 0) await saveScenario(projection.baseline);
        const preferred = next.some((scenario) => scenario.id === activeScenarioId)
          ? activeScenarioId
          : (next[0]?.id ?? null);
        setScenarios(next);
        setActiveScenarioId(preferred);
        await savePlannerPreferences({
          selectedProgrammeVersionId,
          activeScenarioId: preferred,
        });
      })
      .catch((error: unknown) => setOperationMessage(errorMessage(error)));
  }, [activeScenarioId, projection, selectedProgrammeVersionId, storageReady]);

  const activeScenario =
    scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0] ?? null;

  const evaluation = useMemo(
    () =>
      projection && activeScenario
        ? evaluateScenario(projection.programme, activeScenario, evaluationPolicy)
        : null,
    [activeScenario, projection],
  );

  const persistActiveScenario = (scenario: PlanningScenario): void => {
    setScenarios((current) =>
      current.map((candidate) => (candidate.id === scenario.id ? scenario : candidate)),
    );
    setActiveScenarioId(scenario.id);
    setOperationMessage(null);
    void Promise.all([
      saveScenario(scenario),
      savePlannerPreferences({
        selectedProgrammeVersionId: scenario.programmeVersionId,
        activeScenarioId: scenario.id,
      }),
    ]).catch((error: unknown) => setOperationMessage(errorMessage(error)));
  };

  const applyKernelResult = (
    result: ReturnType<typeof moveCourse> | ReturnType<typeof removeCourse>,
  ): void => {
    if (!result.ok) {
      setOperationMessage(kernelErrorMessage(result.error));
      return;
    }
    persistActiveScenario(result.value);
  };

  const selectProgramme = (programmeVersionId: string): void => {
    loadedProgrammeRef.current = null;
    setScenarios([]);
    setActiveScenarioId(null);
    setSelectedProgrammeVersionId(programmeVersionId);
    setOperationMessage(null);
    void savePlannerPreferences({
      selectedProgrammeVersionId: programmeVersionId,
      activeScenarioId: null,
    }).catch((error: unknown) => setOperationMessage(errorMessage(error)));
  };

  const selectScenario = (scenarioId: string): void => {
    setActiveScenarioId(scenarioId);
    void savePlannerPreferences({
      selectedProgrammeVersionId,
      activeScenarioId: scenarioId,
    }).catch((error: unknown) => setOperationMessage(errorMessage(error)));
  };

  const cloneActiveScenario = (): void => {
    if (!activeScenario) return;
    const copy = cloneScenario(
      activeScenario,
      `scenario:${crypto.randomUUID()}` as PlanningScenarioId,
      `${activeScenario.title} copy`,
    );
    setScenarios((current) => [...current, copy]);
    setActiveScenarioId(copy.id);
    void Promise.all([
      saveScenario(copy),
      savePlannerPreferences({
        selectedProgrammeVersionId: copy.programmeVersionId,
        activeScenarioId: copy.id,
      }),
    ]).catch((error: unknown) => setOperationMessage(errorMessage(error)));
  };

  const resetActiveScenario = (): void => {
    if (!activeScenario || !projection) return;
    const reset = decodePlanningScenario({
      ...projection.baseline,
      id: activeScenario.id,
      title: activeScenario.title,
    });
    persistActiveScenario(reset);
  };

  const deleteActiveScenario = async (): Promise<void> => {
    if (!activeScenario || scenarios.length === 1) return;
    const remaining = scenarios.filter((scenario) => scenario.id !== activeScenario.id);
    const next = remaining[0] ?? null;
    setScenarios(remaining);
    setActiveScenarioId(next?.id ?? null);
    await deleteScenario(activeScenario.id);
    await savePlannerPreferences({
      selectedProgrammeVersionId,
      activeScenarioId: next?.id ?? null,
    });
  };

  const exportActiveScenario = (): void => {
    if (!activeScenario) return;
    const blob = new Blob([serializeScenarioEnvelope(activeScenario)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeScenario.title.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importScenario = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !projection) return;
    file
      .text()
      .then(async (contents) => {
        const imported = restoreScenarioEnvelope(contents);
        if (imported.programmeVersionId !== projection.programme.id) {
          throw new Error('The imported scenario belongs to another programme version.');
        }
        const importedWithUniqueId = cloneScenario(
          imported,
          `scenario:${crypto.randomUUID()}` as PlanningScenarioId,
          imported.title,
        );
        setScenarios((current) => [...current, importedWithUniqueId]);
        setActiveScenarioId(importedWithUniqueId.id);
        await saveScenario(importedWithUniqueId);
        await savePlannerPreferences({
          selectedProgrammeVersionId: importedWithUniqueId.programmeVersionId,
          activeScenarioId: importedWithUniqueId.id,
        });
      })
      .catch((error: unknown) => setOperationMessage(errorMessage(error)));
  };

  const clearProgrammeSelection = (): void => {
    loadedProgrammeRef.current = null;
    setSelectedProgrammeVersionId(null);
    setActiveScenarioId(null);
    setScenarios([]);
    setOperationMessage(null);
    void savePlannerPreferences({
      selectedProgrammeVersionId: null,
      activeScenarioId: null,
    }).catch((error: unknown) => setOperationMessage(errorMessage(error)));
  };

  const clearContext = async (): Promise<void> => {
    await clearPlannerData();
    loadedProgrammeRef.current = null;
    setSelectedProgrammeVersionId(null);
    setActiveScenarioId(null);
    setScenarios([]);
    setOperationMessage(null);
  };

  if (!storageReady || programmes.isLoading) {
    return <p className="state">Loading programme and local planning context…</p>;
  }
  if (programmes.isError) return <p className="state error">{programmes.error.message}</p>;
  if (!programmes.data) return null;
  if (!selectedProgrammeVersionId) {
    return <ProgrammeOnboarding programmes={programmes.data} onSelect={selectProgramme} />;
  }
  if (baseline.isLoading || !projection || !activeScenario || !evaluation) {
    return <p className="state">Building the selected programme roadmap…</p>;
  }
  if (baseline.isError) return <p className="state error">{baseline.error.message}</p>;

  if (mode === 'workbench') {
    return (
      <section className="workbench" aria-labelledby="workbench-heading">
        <div className="projection-heading">
          <div>
            <p className="section-label">Kernel workbench</p>
            <h2 id="workbench-heading">Inspect the active roadmap projection</h2>
          </div>
          <button type="button" onClick={() => void clearContext()}>
            Clear local planner data
          </button>
        </div>
        <p className="state subtle">
          This view is generated from a serializable view specification. It exposes the full input,
          evaluation output, relation authority, and data revision without changing the curated Plan
          interface.
        </p>
        <details open>
          <summary>Declarative view specification</summary>
          <pre>{JSON.stringify(projection.viewSpec, null, 2)}</pre>
        </details>
        <details>
          <summary>Programme, scenario, and evaluation</summary>
          <pre>
            {JSON.stringify(
              {
                programme: projection.programme,
                scenario: activeScenario,
                evaluation,
                dataRevision: projection.programme.dataRevision,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </section>
    );
  }

  return (
    <section aria-labelledby="planner-heading">
      <div className="planner-intro">
        <div>
          <p className="section-label">Roadmap projection</p>
          <h2 id="planner-heading">{projection.programme.title}</h2>
          <p>
            Cohort {projection.programme.cohortStartYear} · {projection.programme.durationTerms}{' '}
            terms · {evaluation.totalPlannedCredits} planned credits
          </p>
        </div>
        <div className="planner-context-actions">
          <span className="authority-badge">{projection.programme.relationAuthority}</span>
          <button type="button" onClick={clearProgrammeSelection}>
            Change programme
          </button>
        </div>
      </div>

      <p className="notice">{projection.note}</p>
      {operationMessage && <p className="state error">{operationMessage}</p>}

      <ScenarioToolbar
        scenarios={scenarios}
        activeScenario={activeScenario}
        onSelect={selectScenario}
        onRename={(title) => {
          if (title.trim()) persistActiveScenario(renameScenario(activeScenario, title));
        }}
        onClone={cloneActiveScenario}
        onReset={resetActiveScenario}
        onExport={exportActiveScenario}
        onImport={importScenario}
        onDelete={() => void deleteActiveScenario()}
      />

      <RoadmapEditor
        scenario={activeScenario}
        evaluation={evaluation}
        onMove={(courseVersionId, termId) =>
          applyKernelResult(moveCourse(activeScenario, courseVersionId, termId))
        }
        onRemove={(courseVersionId) =>
          applyKernelResult(removeCourse(activeScenario, courseVersionId))
        }
      />

      <CourseAndRequirementControls
        programme={projection.programme}
        scenario={activeScenario}
        onPlace={(courseVersionId, termId) =>
          applyKernelResult(
            placeCourse(projection.programme, activeScenario, courseVersionId, termId),
          )
        }
        onSelectChoice={(requirementGroupId, courseVersionId, termId) =>
          applyKernelResult(
            selectCourseForRequirement(
              projection.programme,
              activeScenario,
              requirementGroupId,
              courseVersionId,
              termId,
            ),
          )
        }
      />

      <EvaluationPanel evaluation={evaluation} />
    </section>
  );
}
