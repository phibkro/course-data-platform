# Validation report

Validated on 2026-07-23 for the course-decisions-first vertical slice.

## Product journey

The active `bun run dev` command was started from a clean shell without a
database, account, programme, or migration step. Agent Browser exercised the
student application on desktop and mobile:

- the initial page offered exact course-code search immediately;
- searching `TDT4136` returned a live NTNU course insight backed by NTNU course
  search/detail, grades.no, and DBH/HK-dir table 308;
- the result exposed content, learning outcomes, work forms, assessment,
  obligatory activities, prerequisites, grade distribution, failure rate,
  average, median, source status, and evidence;
- unsupported collaboration, attendance, and online-delivery claims remained
  explicitly unknown;
- grades.no and DBH period/sample disagreement rendered as conflicting rather
  than being silently reconciled;
- `?course=TDT4136` persisted the selection across reload;
- desktop and 375 px mobile layouts had no horizontal overflow, with the
  intended sidebar and bottom navigation respectively.

The first clean run exposed two local-environment defects, both fixed before
the successful journey: the pinned Workerd build required compatibility date
`2026-07-21`, and Nix-launched Workerd needed the system CA bundle passed
explicitly.

## Automated checks

The canonical `bun run validate` gate regenerates OpenAPI and runs formatting,
lint, both TypeScript compilers, and the full Vitest suite. `bun run build`
performs the Worker dry run and production web build.

The suite covers boundary rejection, ordinary-term grade windows, cohort
thresholds, pass/fail separation, weighted averages, per-field source
reconciliation, partial upstream failures, evidence integrity, transport
responses, Foldkit scenes/stories, and student-client error handling.

## Live-source qualification

The live journey confirms the currently implemented request and parsing paths
against all four upstream endpoints. DBH table 308 was additionally queried
grouped by `Emnekode`, confirming that NTNU versions use the
`TDT4136-1`-style suffix; the adapter therefore filters `TDT4136-%` so it keeps
course versions without absorbing longer prefix-matching course codes.

Checked-in source fixtures remain deliberately labelled `fixture` and are not
presented as captured source facts. Expanding the live golden corpus beyond
TDT4136 and preserving provider-approved response captures remains a
pre-public-launch task rather than a hidden claim of this slice.

## Current product boundary

This release candidate makes one known course code genuinely understandable.
It does not yet solve discovery for students who know a topic or title but not
the code, and it does not yet offer shortlist comparison. Those are the next
student-value slices; programme planning, authentication, full replication,
and multi-institution support remain deliberately later.
