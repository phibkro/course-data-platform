# Next vertical slice: discover a useful course

## Goal

Let a student who does not already know an NTNU course code search by code,
title, or topic, understand the first useful signals quickly, and open the
existing evidence-backed course insight.

The exact-code TDT4136 walking skeleton is complete. Preserve it as the detail
path; do not replace it with a new architecture.

## Required path

```text
Foldkit search with URL state
  -> fast NTNU result summaries
  -> progressive per-result enrichment
  -> select a course
  -> existing CourseInsight detail and evidence
```

## Scope

1. Consume the existing `/v1/course-search` contract from the student web.
2. Support code, Norwegian/English title, and topic-text queries.
3. Put the query in the URL so discovery survives reload and is shareable.
4. Render fast official identity fields first: code, title, credits, term, and
   campus where known.
5. Enrich visible results progressively with compact assessment, obligatory
   work, and grade-risk signals without blocking the initial list.
6. Preserve explicit idle, searching, partial, empty, failed, and selected
   states in the Foldkit model.
7. Keep unavailable/conflicting facts honest; never turn missing enrichment
   into a negative claim.
8. Add a 10–20 course golden corpus spanning old/new courses, pass/fail,
   multiple campuses, missing grades, source failure, and conflicting windows.
9. Measure the live search/enrichment path before introducing D1 caching.

## Acceptance criteria

- A fresh visitor can find `TDT4136` using “algoritmer”, its title, or its code.
- Initial results appear without waiting for every grade/detail provider.
- Each result makes clear which facts are official, inferred, unavailable, or
  still enriching.
- Selecting a result opens the current decision-oriented detail without losing
  the search query.
- Back/forward navigation and reload preserve query and selection.
- Source failure leaves useful official result summaries visible.
- Desktop keyboard and 375 px mobile journeys pass Agent Browser smoke tests.
- Type checks, lint, format, tests, OpenAPI generation, and builds remain green.

## Immediately after

Add a local, account-free shortlist and comparison view for two to four
courses. Compare workload, assessment, obligatory work, collaboration,
attendance, remote feasibility, and grade outcomes using the same Fact and
evidence semantics.

## Still deferred

- programme compatibility and planning;
- authentication and cross-device sync;
- full catalogue replication and scheduled ingestion;
- second-institution support;
- discretionary design-system expansion.

## Design-system constraint

ADR-011 continues to freeze discretionary theme work. Reuse the existing
Material You semantic tokens and Foldkit primitives. Add visual machinery only
where discovery or comparison needs it.
