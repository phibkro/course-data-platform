# Future direction: pathways through study state

## Status

Exploratory product and domain note. This records a potential direction after
course discovery, detail, shortlisting, and comparison demonstrate repeat value.
It does not change the delivery order in ADR-012.

The concrete, data-gated surface contracts derived from this research are:

- [`degree-overview-and-pathways.md`](./degree-overview-and-pathways.md)
- [`schedule-and-external-sync.md`](./schedule-and-external-sync.md)

## Product opportunity

A course catalogue helps a student understand individual choices. A planner
becomes substantially more valuable when it also explains how each choice
changes what remains possible.

Selecting a current degree programme should reduce the ordinary search space
from the entire institutional catalogue to a useful progression:

1. required courses;
2. courses in the programme's elective groups;
3. relevant courses that may fit the programme;
4. the remaining institutional catalogue.

This is progressive narrowing, not permanent hiding. A student must always be
able to search beyond the programme context.

Future intentions narrow a different space. A student completing an informatics
bachelor may be more likely to consider computing-related master's programmes,
but the product must not turn that likelihood into an exclusion. Students should
be able to mark future pathways as primary, considered, discoverable, or hidden.
Explicit intent overrides inferred relevance.

The long-term product promise is:

> See what you can choose now, and what those choices make possible later.

## Student journey

The main value loop remains:

```text
Explore -> Inspect -> List -> Compare -> Plan -> Schedule
```

Pathway awareness is a lens across Explore, Compare, and Plan rather than
necessarily another top-level destination:

- Explore ranks and groups courses using optional programme context.
- Inspect explains how a course relates to current and future requirements.
- List preserves candidates without requiring an immediate commitment.
- Compare shows which options preserve or narrow selected pathways.
- Plan evaluates accumulated choices and remaining degrees of freedom.
- Schedule adds offering, collision, workload, location, and attendance
  constraints.
- Findings feed back into Explore as actionable searches for alternatives.

## Abstract model

It is useful to view study planning as movement through a constrained state
space. A state contains, at minimum:

- the current programme version and catalogue data revision;
- completed, current, and planned courses;
- placement of planned courses into study terms;
- selected future pathways and their versions or admission cycles;
- student-owned preferences and practical constraints;
- unresolved or conflicting evidence.

An action such as adding, removing, replacing, or moving a course produces a new
state. Requirements evaluate states and transitions. They may permit a
transition, prohibit it, or produce a finding about risk or uncertainty.

The resulting state space can be presented as a graph, but it should not be
stored as only a graph whose nodes are courses. Degree validity depends on
accumulated properties such as credits, credit categories, requirement-group
allocation, ordering, time, overlapping content, and destination recognition.
Two students who select the same course can therefore reach different planning
states.

Useful graph projections include:

- prerequisite and co-requisite relations between courses;
- courses that satisfy a particular requirement group;
- transitions between scenario states;
- pathways that remain reachable from a scenario;
- findings that explain why a transition opens, risks, or closes a pathway.

This framing does not require a general graph database or solver. The canonical
representation can remain explicit scenario state plus deterministic
requirements and structured findings. Graphs, candidate generation, and
solver-backed optimization are derived capabilities.

## Current programme and future pathways

Current study and future intent are separate contexts:

- **Current programme** describes the official curriculum the student is
  completing.
- **Future pathways** describe degrees, exchanges, specializations,
  qualifications, or practical outcomes the student may want to preserve.

Official curriculum, a student's planned scenarios, and actual progress remain
separate objects. A pathway always identifies its authority, version, and
relevant time window. Examples include:

- completion of the current degree;
- admission to a particular master's programme and intake;
- qualification for a specialization;
- exchange eligibility;
- professional or teaching accreditation;
- internship prerequisites;
- a plan compatible with remote study, employment, or another personal
  constraint.

The same plan may be evaluated against several pathways without treating any one
of them as the student's permanent identity.

## Pathway status

The product should report reachability relative to the current scenario, not
make unsupported admissions guarantees:

- **Open** — known requirements are satisfied by the current state.
- **On track** — unsatisfied requirements can still fit in the remaining plan.
- **At risk** — still reachable, but only through constrained future choices.
- **Closed by current plan** — not reachable without changing the scenario.
- **Unknown** — evidence is insufficient, unavailable, or conflicting.

These are evaluation results, not stored booleans. Each result needs findings
that identify the responsible choices, rules, evidence, and possible remedies.

Counterfactual explanations are central:

> Adding course A keeps eight selected pathways open.

> Replacing course A with course B leaves the plan short of ten recognized
> programming credits for one future pathway.

> Moving course C resolves a prerequisite sequence but introduces a timetable
> collision.

The interface should let a student inspect the cause, source, uncertainty, and
alternatives behind each statement.

## Constraint families

Potential requirements and quality-of-life findings include:

- required courses and elective groups;
- minimum or maximum credits by level or category;
- prerequisites, co-requisites, and ordered sequences;
- programme-version and cohort rules;
- course availability, campus, term, and teaching language;
- timetable and exam collisions;
- workload balance and maximum term load;
- obligatory activity, attendance, collaboration, and group work;
- remote-study feasibility;
- exclusions and reduced-credit content overlap;
- exchange-term and mobility constraints;
- external admission or accreditation requirements;
- uncertainty caused by missing, stale, or conflicting evidence.

Some constraints are hard institutional rules. Others are warnings,
preferences, or optimization objectives. The domain must preserve that
distinction.

## Cross-institution recognition

Course content, source-institution classification, and destination-institution
recognition are different facts.

For example, an NTNU project course may contain substantial programming while
not being classified as a programming course, and a receiving institution may
consequently recognize none of its credits toward a programming-specific
master's admission requirement.

A future recognition model needs:

- the destination institution, programme, and admission cycle;
- the requirement and required credit category;
- recognized credits per source course, including partial recognition;
- a status such as recognized, not recognized, case-by-case, disputed, or
  unknown;
- provenance, authority, validity period, and evidence;
- separation between official rules, published equivalencies, individual
  administrative decisions, and community reports.

Content evidence may say that a course substantially involves programming while
recognition evidence says that no destination authority has confirmed it will
count. These statements are compatible and should both be visible.

The useful student-facing finding is not an unqualified eligibility verdict:

> Your plan contains 30 credits of courses with substantial programming, but
> only 20 credits are currently verified as recognized for this pathway. Two
> courses remain unverified.

Possible actions include choosing an unambiguously recognized course, asking the
destination institution for a written assessment, and exporting the relevant
course descriptions, learning outcomes, and assessment evidence.

## Provenance and uncertainty

Every factual relation and evaluation finding follows the existing provenance
rules. In particular:

- unknown is not false;
- lack of recognition evidence is not evidence of rejection;
- community experience is not official policy;
- inferred relevance does not satisfy a formal requirement;
- conflicting decisions remain conflicting;
- rules are scoped to programme versions, admission cycles, and data revisions.

The UI should explain whether a finding is official, administrative, inferred,
fixture-backed, or student-authored.

## Candidate product sequence

This direction should be validated incrementally rather than by first building a
universal programme ontology:

1. Prove course discovery, evidence-backed detail, List, and Compare.
2. Add optional programme-aware Explore for one NTNU programme version.
3. Evaluate a local scenario against its required and elective groups.
4. Add term placement, prerequisite sequencing, and schedule findings.
5. Model one high-cost future pathway, such as a specific cross-institution
   master's admission requirement for one intake.
6. Test counterfactual explanations and pathway-preservation suggestions with
   real students.
7. Generalize only the rule families demonstrated by those slices.

The first cross-institution experiment should be manually curated and
transparent. Its success criterion is that a student discovers a consequential
gap early enough to change the plan, not that the platform represents every
institutional edge case.

## Architectural implications

The existing inward dependency direction remains appropriate:

- the domain represents versioned requirements, recognition relations,
  authority, and uncertainty;
- the study kernel applies pure transitions and deterministic evaluations;
- application use cases acquire the explicit programme versions, data
  revisions, evidence, and student scenario needed for evaluation;
- infrastructure adapters obtain institution-specific rules and recognition
  evidence;
- contracts expose findings and their evidence without leaking storage rows;
- the web application owns scenario editing, URL state, local preferences, and
  explanation-oriented interaction.

Course relations may support graph projections, but a graph database, generic
knowledge ontology, or solver is not a prerequisite. Correct and explainable
evaluation of one useful pathway should precede general optimization machinery.
