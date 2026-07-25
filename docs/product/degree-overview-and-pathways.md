# Degree overview, scenarios, and future pathways

- Status: Data-gated product specification
- Date: 2026-07-25
- Product loop:
  `Degree finding -> Explore -> Inspect -> List -> Compare -> update scenario`
- Research basis: [`future-pathways.md`](./future-pathways.md)
- Temporal evaluator:
  [`schedule-and-external-sync.md`](./schedule-and-external-sync.md)

## Outcome

Degree reduces the mental work of reconciling curriculum rules, completed work,
planned choices, and future intentions. It answers:

1. Which programme and rule version am I evaluating?
2. What is completed, planned, and still missing?
3. Which requirements are satisfied, at risk, unknown, or violated?
4. Which decision needs attention next?
5. Which selected future pathways remain reachable?

It is not a digitized curriculum PDF, a single completion percentage, or an
unsupported admission verdict.

## Readiness gate

The interactive Degree surface requires one published, versioned programme
projection with typed and attributed relations:

- programme, cohort, and curriculum version;
- required courses;
- elective or choice groups and their completion rules;
- credit, level, and category requirements;
- exclusions and reduced-credit overlap when published;
- prerequisites and ordered relations when published;
- validity period, source, publication revision, and freshness.

Before that gate, work is limited to acceptance journeys, fixtures, and pure
study-kernel evaluation. The first implementation deliberately covers one NTNU
Informatics programme version, not every programme.

## Separate objects

The page projects four distinct objects:

### Official curriculum

Versioned institutional rules and relations. These are immutable within an
evaluation and carry official evidence.

### Actual progress

Courses the student reports as completed or currently taking. Until an
authorized institutional import exists, this is student-authored—not official
transcript evidence.

### Planned scenario

A local, editable hypothesis containing course identities, term placements,
and explicit requirement allocations. Several scenarios may evaluate against
the same curriculum without changing it.

### Future pathways

Versioned intentions such as a master's intake, specialization, exchange,
accreditation, or remote-study constraint. They evaluate the scenario but do
not become part of the current degree's official curriculum.

These objects never share mutable rows or collapse into a single `student
degree` record.

## Scenario input

```ts
interface DegreeScenario {
  readonly id: DegreeScenarioId;
  readonly programmeVersionId: ProgrammeVersionId;
  readonly programmeDataRevision: string;
  readonly completedCourses: ReadonlyArray<StudentCourseRecord>;
  readonly plannedPlacements: ReadonlyArray<TermPlacement>;
  readonly requirementAllocations: ReadonlyArray<RequirementAllocation>;
  readonly selectedPathways: ReadonlyArray<PathwayVersionId>;
}
```

Planner and kernel operations always receive programme version and data revision
explicitly. There is no hidden current cohort.

Evaluation is pure:

```text
(programme version, data revision, scenario, pathway versions, evidence)
  -> structured findings
```

Completion, pathway status, and warnings are derived results and are never
persisted booleans.

## Degree summary

The header establishes context:

```text
Bachelor in Informatics
2025 curriculum · Scenario: Main plan

Completed  60 credits
Planned    75 credits
Remaining  45 credits
```

A segmented progress visualization may show requirement groups, but never
replaces their rules. A student can hold nearly all nominal credits and still
miss a mandatory course or category.

The summary shows:

- programme, institution, cohort/curriculum version;
- scenario name;
- completed, planned, allocated, and remaining credits;
- unresolved or conflicting credits;
- data revision, freshness, and provenance;
- the number and severity of findings requiring attention.

## Attention needed

Actionable findings precede the full curriculum:

```text
2 decisions need attention

Warning: 10 verified programming credits remain for the selected UiO pathway.
Your plan includes programming work, but destination recognition is unknown.

Blocking: TDT4120 requires a prerequisite not completed or planned.

Unknown: TMA4245 has no published Spring 2028 offering.
```

Every finding contains:

- rule and version;
- severity: blocking, warning, preference, or unknown;
- responsible courses, allocations, or term placements;
- evidence and source state;
- consequence;
- actionable remedies.

Unknown and conflicting evidence never silently close or open a pathway.

## Semester journey

The page shows the multi-year scenario:

```text
Year 1             Year 2             Year 3
Autumn · 30        Autumn · 30        Autumn · 22.5
Spring · 30        Spring · 30        Spring · 37.5
```

Expanding a term shows course identities, credits, requirement allocations, and
findings. Desktop may use compact term columns; mobile uses a vertical sequence
with critical findings before course detail.

A period label from List can propose placements, but a label remains an
organizational hint. Adding the course to a scenario is an explicit action.
Later label changes produce a proposed diff rather than changing the scenario.

## Requirement view

Requirements are presented as understandable groups:

```text
Foundational courses    45 / 45 credits   Complete
Programming             20 / 30 credits   10 missing
Mathematics             22.5 / 20         Complete
Electives                15 / 30 credits   15 missing
Bachelor thesis           0 / 15 credits   Not planned
```

Expansion shows:

- required courses and completion state;
- elective alternatives and choice rules;
- planned courses allocated to the group;
- plausible but unverified relations;
- overlap, exclusions, and double-counting findings;
- direct source evidence.

Allocation is explicit. A course may relate to several groups, but its credits
are not double-counted unless the official rule permits it. The evaluator may
suggest an allocation; the explanation shows why.

## Future pathways

The student selects pathways to track rather than receiving every possible
destination:

```text
UiO Informatics MSc          At risk
NTNU Computer Science MSc    On track
Exchange in Year 3           Open
```

Statuses are relative to an explicit scenario and version:

- **Open** — all known requirements are currently satisfied.
- **On track** — remaining known requirements fit within the scenario.
- **At risk** — reachable only through constrained future choices.
- **Closed by current plan** — requires changing the scenario.
- **Unknown** — evidence is insufficient, unavailable, or conflicting.

These are explanatory evaluation results, not guarantees of admission.

Counterfactuals identify concrete changes:

> Replacing course A with course B supplies the remaining verified programming
> credits while preserving the current term load.

> Moving course C repairs prerequisite order but introduces a known timetable
> conflict.

## Cross-institution recognition

Course content, source-institution category, and destination recognition remain
different facts.

An NTNU project course may contain substantial programming while a particular
UiO master's intake has no evidence that it recognizes those credits as
programming. Both statements can be true.

A recognition relation identifies:

- destination institution, programme, and admission cycle;
- source course/version;
- requirement and recognized credits, including partial recognition;
- recognized, not recognized, case-by-case, disputed, or unknown state;
- official, administrative, inferred, fixture, community, or student-authored
  authority;
- source, validity period, and revision.

The first experiment is manually curated and transparent for one high-cost
pathway. Success means exposing a consequential gap early enough to change a
plan, not modelling every institution.

## Next actions

Findings are control surfaces:

- `Find electives satisfying this group`
- `Find courses with verified programming recognition`
- `Find an alternative offered in Spring`
- `Compare candidates that preserve this pathway`
- `Check this term's schedule`

Each action opens Explore, List, Compare, or Schedule with explicit context and
visible ranking reasons. A student can always broaden beyond programme context.

## Degree and Schedule boundary

- Degree owns multi-year curriculum validity, term placement, credit
  allocation, sequencing, and pathway reachability.
- Schedule owns dated activities, examinations, travel, and temporal workload
  within one academic period.
- Degree sends an explicit term snapshot to Schedule.
- Schedule returns structured findings tied to the same course identities and
  revisions.
- A schedule repair proposes a scenario transition and requires confirmation.

## Responsive and accessible behaviour

- Desktop prioritizes summary, attention, semester journey, and a findings
  rail without becoming a dashboard of unrelated cards.
- Mobile orders attention before progress, terms, requirements, and pathways.
- Requirement state uses text and semantics in addition to colour and icons.
- Progress visualizations have prose/table equivalents.
- Keyboard and screen-reader users can inspect causes and remedies without
  traversing decorative charts.
- English and Norwegian cover requirement, recognition, pathway, uncertainty,
  and source terminology.
- URL/history preserve selected scenario and expanded finding where safe; local
  student data is not embedded in shareable URLs.

## First useful slice

### D0: Programme projection

- one NTNU Informatics programme and curriculum version;
- required courses, elective groups, credit rules, source revision;
- quality report and typed unknown/conflicting relations.

### D1: Local scenario

- select programme/cohort without mandatory onboarding;
- enter completed courses as student-authored;
- add saved courses to explicit terms;
- deterministic progress and missing-requirement findings.

### D2: Programme-aware Explore

- `In this curriculum`, `Required`, and `Elective` filters;
- relationship-first ranking with visible reasons;
- restricted or unknown access remains a finding rather than hidden data.

### D3: One pathway

- one manually curated UiO computing master's intake;
- verified/unknown programming-credit recognition;
- open/on-track/at-risk/closed/unknown evaluation;
- counterfactual alternatives linked to Explore.

### D4: Schedule feedback

- create a Schedule snapshot for one term;
- return temporal findings;
- accept an explicit repair transition.

## Acceptance

- A student understands programme version, progress basis, and data freshness
  without opening source documentation.
- Official curriculum, student-reported progress, plans, and pathways cannot be
  mistaken for one another.
- Required and elective groups explain which courses and allocations satisfy
  them.
- Credits are never silently double-counted.
- A finding explains cause, rule, evidence, uncertainty, and remedy.
- The first cross-institution pathway distinguishes course content from
  destination recognition.
- Degree findings lead directly to useful Explore or Schedule actions.
- Phone, desktop, keyboard, EN/NB, axe, pure-kernel, data-revision, type, lint,
  test, OpenAPI, and build checks pass for delivered slices.

## Deferred

- universal programme ontology;
- every NTNU programme before the first slice proves value;
- generalized admission guarantees;
- automatic institutional transcript import without authorization;
- graph database or optimization solver as a prerequisite;
- account synchronization;
- social or adviser collaboration;
- second-institution course adapters beyond a curated recognition experiment.
