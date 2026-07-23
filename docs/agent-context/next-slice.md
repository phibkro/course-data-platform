# Next vertical slice: one useful course

## Goal

Make an exact search for `TDT4136` produce a genuinely useful, evidence-backed
course page in the browser.

## Required path

```text
Foldkit search
  -> explicit loading/partial/success/failure model
  -> Elysia course endpoint
  -> Effect course service
  -> validated NTNU + grade-provider adapters
  -> normalized CourseInsight with evidence
  -> useful course detail
```

## Scope

1. Define the public course summary and CourseInsight DTOs.
2. Preserve known, unknown, unavailable, suppressed, and conflicting facts.
3. Add validated NTNU search and course-detail source adapters.
4. Add validated grades.no and DBH/HK-dir grade mappings.
5. Return partial success when one provider fails.
6. Build the Foldkit exact-search and course-detail state machine.
7. Style the required primitives with Material You semantic tokens.
8. Add source-fixture, contract, Foldkit Story/Scene, and browser tests.
9. Add D1 caching only after measuring the live request path.
10. Express only the Worker and cache actually required in Alchemy v2.

## Acceptance criteria

- A fresh visitor can search `TDT4136` without choosing a programme.
- The response identifies the course and its credits and availability.
- The page explains content, teaching, assessment, obligatory activity,
  collaboration, attendance, prerequisites, and grade outcomes where supported.
- Grade statistics include period/source, sample size, distribution, failure
  rate, and average or median only when supported.
- Every displayed factual section links to evidence and exposes freshness.
- Unknown and conflicting facts are visible and are not rendered as `false`.
- One upstream failure produces a useful partial result and source warning.
- The workflow passes its Foldkit Scene test and an agent-browser smoke test.
- Type checks, lint, format, unit tests, OpenAPI generation, and builds pass.

## Deferred

- broad search result enrichment;
- local bookmarks and comparison;
- programme compatibility and planning;
- authentication;
- full catalogue replication and scheduled ingestion;
- second-institution support.

## Design-system constraint

ADR-011 continues to freeze discretionary theme work. Implement only the
Material You tokens and Foldkit primitives required by exact search and course
detail. The React shadcn registry is not a component source for the Foldkit
interaction tree.
