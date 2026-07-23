# Validation report

Validated on 2026-07-23 for the course-decisions-first vertical slice.

## Product journey

The active `bun run dev` command was started from a clean shell without a
database, account, programme, or migration step. On this Nix workstation the
command automatically entered the repository development shell. Agent Browser
exercised the student application on desktop and mobile:

- the initial page loaded 40 alphabetically sorted rows from 2,825 live NTNU
  autumn 2026 offerings without requiring a known course code;
- “Show more courses” expanded the list from 40 to 80 while preserving the
  source-reported total;
- search, term, campus, study-level, open-admission, English-language, and sort
  state were represented in the URL;
- a code/title search for `TDT4136` automatically switched to NTNU relevance
  and ranked the exact course first;
- filtering the search to Trondheim and master level returned 10 courses;
- open-admission filtering returned 898 courses;
- opening `TDT4136` returned a live NTNU course insight backed by NTNU course
  search/detail, grades.no, and DBH/HK-dir table 308;
- the result exposed content, learning outcomes, work forms, assessment,
  obligatory activities, prerequisites, grade distribution, failure rate,
  average, median, source status, and evidence;
- unsupported collaboration, attendance, and online-delivery claims remained
  explicitly unknown;
- grades.no and DBH period/sample disagreement rendered as conflicting rather
  than being silently reconciled;
- selection preserved the catalogue query, and back/forward navigation
  restored the corresponding filter state;
- desktop and 375 px mobile layouts had no horizontal overflow, with the
  intended sidebar and bottom navigation respectively.
- the accessibility tree exposed one correctly named checkbox per boolean
  filter, without hidden-input duplication.

The first clean run exposed two local-environment defects, both fixed before
the successful journey: the pinned Workerd build required compatibility date
`2026-07-21`, and Nix-launched Workerd needed the system CA bundle passed
explicitly.

## Automated checks

The canonical `bun run validate` gate regenerates OpenAPI and runs formatting,
lint, both TypeScript compilers, and the full Vitest suite. `bun run build`
performs the Worker dry run and production web build.

The final gate passed 29 test files / 107 tests. The production build emitted a
308.84 KiB gzip Worker upload and a 123.57 KiB gzip main browser bundle.

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

This release candidate supports broad scanning and narrowing by the factual
facets available from NTNU's catalogue endpoint, then makes an opened course
genuinely understandable. Result cards intentionally do not claim credits,
assessment form, collaboration, remote feasibility, obligatory work, or grade
risk until richer sources have been loaded. Batch grade signals, progressive
detail enrichment, and shortlist comparison are the next student-value slices;
programme planning, authentication, full replication, and multi-institution
support remain deliberately later.
