# Schedule, conflict findings, and external synchronization

- Status: Data-gated product specification
- Date: 2026-07-25
- Product loop: `List -> Schedule -> Resolve -> Explore`
- Input contract:
  [`list-collections-and-compare.md`](./list-collections-and-compare.md)
- Programme context:
  [`degree-overview-and-pathways.md`](./degree-overview-and-pathways.md)

## Outcome

Schedule answers whether a proposed term is feasible and what the student can
do when it is not. It is initially a findings-first constraint checker, not a
replacement for the official TP timetable or the established ntnu.1024.no
planner.

A student can:

1. create a schedule scenario from selected saved courses, a labelled
   collection, a Degree term, an external schedule, or an ad-hoc set;
2. distinguish blocking, resolvable, practical, workload, and unknown findings;
3. choose among known parallel activities;
4. follow an explanation back to Explore for alternatives;
5. export or synchronize an accepted course set explicitly.

## Readiness gate

The interactive surface does not ship until one current NTNU period has a
validated timetable/offering-event contract covering:

- stable course and offering identity;
- activity identity and type;
- start/end, timezone, date range, and recurrence;
- fixed versus alternative activity groups;
- cancellation and exception dates;
- campus, building, and room when known;
- source, observation time, and freshness;
- explicit missing, stale, unavailable, and conflicting states.

Until then, work is limited to provider investigation, domain fixtures, pure
evaluation, and acceptance prototypes. An empty calendar shell is not a product
milestone.

## Scenario model

```ts
interface ScheduleScenario {
  readonly id: ScheduleScenarioId;
  readonly academicPeriod: AcademicPeriod;
  readonly courseOfferings: ReadonlyArray<CourseOfferingSelection>;
  readonly activitySelections: ReadonlyArray<ActivitySelection>;
  readonly preferences: SchedulePreferences;
  readonly dataRevision: string;
  readonly externalLinks: ReadonlyArray<ExternalScheduleLink>;
}
```

The domain input is an explicit snapshot of offering identities. `From label`,
`from Degree term`, and `from 1024` are web-level creation conveniences, not
polymorphic domain ownership.

If the source collection later changes, the application computes a proposed
diff:

```text
Add       TDT4120
Keep      TDT4100, TMA4245
Remove    none
```

The scenario changes only after confirmation. No live alias silently mutates a
plan.

## Activity semantics

A course may contain fixed and alternative activities:

```text
TDT4100
|- Lecture — fixed
|- Exercise — choose one
|  |- Group 1
|  |- Group 2
|  `- Group 3
`- Lab — required, group not yet published
```

Attendance requirement is a separate fact from an event's existence.
Alternative availability is separate from the student's selection. A timetable
event does not prove that attendance is mandatory.

Recurrence supports weekly, selected-week, odd/even-week, one-time, cancelled,
and moved events. Evaluation expands recurrence deterministically within the
explicit academic period and preserves source exceptions.

## Finding classes

### Blocking

- overlapping fixed activities known to be required;
- overlapping fixed examinations;
- no compatible activity alternative;
- a hard institutional rule supplied by Degree evaluation.

### Resolvable

- a compatible alternative exercise, seminar, or lab group exists;
- an optional activity may be deselected;
- moving a planned course to another offered period removes the conflict.

### Practical warnings

- insufficient travel time between campuses or locations;
- short transitions with unknown location;
- excessive contact-hour density;
- a remote-study preference conflicts with known in-person evidence.

### Workload warnings

- several known examinations in a short window;
- published project, report, or submission deadlines cluster;
- several group-heavy courses occupy the same period;
- planned credits exceed a student-selected threshold.

Assessment form alone never proves workload timing. Missing deadlines never
imply a light week.

### Unknown

- schedule not published;
- recurrence or group structure incomplete;
- attendance requirement unknown;
- stale or failed provider;
- location or travel time unknown.

The summary says `No known conflicts` only when appropriate. It does not say
`Conflict free` while relevant facts are missing or unchecked.

## Evaluation

The first kernel is deterministic:

```text
(scenario, offering events, explicit preferences, data revision)
  -> structured findings
```

Findings include severity, responsible identities, interval/evidence, source
state, explanation, and available remedies. They are derived and never stored
as durable booleans.

A bounded activity-choice search may later suggest compatible group
combinations. It is an explainable suggestion, not a guarantee of enrolment or
group capacity. A general solver is not required.

## Information architecture

The page begins with feasibility, not a calendar:

```text
Autumn 2027 · 5 courses · 37.5 credits

1 blocking conflict
2 resolvable activity conflicts
1 short campus transition
2 courses with incomplete schedule data
```

Each finding offers relevant actions:

- choose another activity group;
- inspect the official source;
- move a course;
- find alternatives satisfying the same Degree requirement;
- keep the conflict and mark it for manual review.

Desktop may combine a week grid, sticky findings rail, activity controls, and a
separate examination timeline. Mobile defaults to a chronological agenda and
findings list; day/week grids are optional projections.

Tiny coloured rectangles are never the only way to discover a conflict.

## Schedule and Degree boundary

- Schedule evaluates temporal feasibility within a term.
- Degree evaluates multi-year curriculum validity, sequencing, credit
  allocation, and pathway reachability.
- A Degree term can create a Schedule snapshot.
- Schedule findings return to Degree as structured evidence.
- Moving a course in Schedule proposes a Degree scenario change; it does not
  silently rewrite official curriculum or planned state.

## External tools

### Official TP

TP is the authoritative student timetable destination for registered courses
and manually selected parallel activities. Uni Planner links to the exact
course/period source where possible and states which events it has checked.

Initial integration is outbound:

- open the detailed official timetable;
- export a verified local iCalendar file when event data permits;
- explain that group choice and enrolment remain in the official system.

Authenticated TP interfaces are not scraped or proxied without an explicit
supported contract and institutional authorization.

### ntnu.1024.no

The 1024 planner is a complementary semester timetable and export tool. Uni
Planner may integrate rather than duplicate its mature calendar presentation.

Integration stages are:

1. remember a semester-specific schedule connection locally and deep-link;
2. import its course set through a supported contract;
3. preview an export from a selected List collection or Schedule scenario;
4. add opt-in two-way reconciliation only with a stable revisioned API.

HTML scraping is not a synchronization contract. If needed, Uni Planner should
collaborate upstream on a narrow API.

## Identifier and privacy model

The current human-entered 1024 name may function as both lookup key and access
capability. Uni Planner therefore treats it as a secret, never as a safe public
username and never as a global student identity.

The preferred upstream creation contract atomically returns:

```ts
interface ExternalScheduleCapability {
  readonly scheduleId: string;
  readonly readUrl: string;
  readonly writeCapability: string;
  readonly revision: string;
}
```

- Server-issued IDs own uniqueness.
- Read and write capabilities are separable and revocable where supported.
- A human-facing nickname remains local and is not an authorization key.
- Capability material is never placed in analytics, logs, referrers, or
  screenshots by Uni Planner.
- Connections are scoped to provider and academic period.

If upstream cannot issue IDs, the fallback generates a high-entropy identifier,
attempts atomic creation, and retries on conflict. A separate availability check
followed by creation is not collision-free.

Students are not encouraged to use a Feide username or personally identifying
name. Local backup/recovery is offered because clearing browser data otherwise
loses the connection.

## Synchronization semantics

Synchronization is always previewed:

```text
Add remotely       TDT4100, TMA4245
Import to List     EXPH0300
Already aligned    TMA4411
External-only data 2 deadlines
Remove             nothing automatically
```

- Uni Planner's saved state remains student-owned.
- External removal never deletes bookmarks, labels, notes, or Degree progress.
- Imported courses are saved once and may receive the mapped period label.
- Unknown course mappings remain visible.
- Course selection, activity-group selection, deadlines, and custom external
  events remain distinct.
- Writes use a known revision or fail with a conflict requiring a fresh diff.
- Sync direction is explicit: import, export, or two-way.

External schedules can reveal a student's study pattern. No data leaves the
device without informed opt-in naming the provider and payload.

## Delivery slices

### S0: Data proof

- document provider contracts and authorization;
- capture versioned fixtures for one NTNU period;
- validate recurrence, groups, exceptions, sources, and freshness.

### S1: Findings kernel

- pure overlap and recurrence evaluation;
- blocking, resolvable, warning, and unknown findings;
- travel preference and explicit incomplete-data treatment.

### S2: Student journey

- create a snapshot from selected List courses;
- findings-first phone and desktop views;
- activity choice and Explore repair links;
- no external writes.

### S3: Export

- supported TP deep links;
- local iCalendar where evidence is complete;
- previewed course-code export.

### S4: 1024 collaboration

- upstream-supported atomically created identifier/capability;
- explicit import/export diff;
- revision conflict handling and local recovery;
- two-way sync only after one-way use proves value.

## Acceptance

- A student checks a labelled term collection and learns whether evidence is
  complete before seeing a calendar.
- Fixed and alternative activities produce different findings.
- Week patterns and exceptions do not create false collisions.
- Missing data never becomes `no conflict`.
- Every finding identifies cause, evidence, uncertainty, and a next action.
- A source collection change produces an explicit scenario diff.
- External export never silently removes local or remote student state.
- Generated identifiers cannot collide through a check-then-create race.
- Phone agenda, desktop grid, keyboard, EN/NB, axe, type, lint, test, and build
  checks pass for the delivered slice.

## Deferred

- automatic enrolment or activity registration;
- scraping authenticated TP sessions;
- unsupervised two-way synchronization;
- general timetable optimization;
- social schedule sharing;
- server-side student profiles;
- future-period guarantees when NTNU has not published events.
