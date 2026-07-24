# Next vertical slice: decision signals while browsing

> Execution anchor: [`../product/scan-and-persist-design.md`](../product/scan-and-persist-design.md)

## Goal

Let a student scan a broad NTNU catalogue and see the first decision-relevant
signals without opening every result.

The browse-first catalogue and evidence-backed detail are complete. Preserve
both as the product path; enrich the list without making it wait for every
upstream.

## Required path

```text
Foldkit catalogue with URL state
  -> fast official NTNU result summaries
  -> batched grade summaries for loaded course codes
  -> bounded detail enrichment for visible or shortlisted courses
  -> select a course
  -> existing CourseInsight detail and evidence
```

## Scope

1. Add one batched DBH/HK-dir grade-summary capability for the course codes
   already loaded in the catalogue.
2. Show sample size, covered period, and failure-rate availability on result
   cards; preserve pass/fail-only and absent-grade cases explicitly.
3. Fetch NTNU detail only for visible, opened, or shortlisted courses, with a
   concurrency limit and cancellation for filters that change.
4. Derive compact assessment and obligatory-work signals through the existing
   evidence model; do not interpret catalogue multimedia as remote teaching or
   `examOnly` as an assessment claim.
5. Keep initial official catalogue rows interactive while enrichments load or
   fail independently.
6. Preserve explicit unchecked, loading, known, inferred, conflicting,
   unavailable, and failed states in the Foldkit model.
7. Add a 10–20 course golden corpus spanning old/new courses, pass/fail,
   multiple campuses, missing grades, source failure, and conflicting windows.
8. Measure visible-card enrichment before introducing D1 caching or a full
   catalogue replication pipeline.

## Acceptance criteria

- Initial official rows still appear without waiting for grade/detail
  providers.
- Loaded cards receive grade availability in a bounded number of requests,
  rather than one DBH request per card.
- Each signal makes clear whether it is checked, known, inferred, conflicting,
  unavailable, or failed.
- Changing filters cancels or ignores stale enrichment and never attaches
  evidence to the wrong course.
- Source failure leaves useful official result summaries visible and usable.
- Desktop keyboard and 375 px mobile journeys pass Agent Browser smoke tests.
- Type checks, lint, format, tests, OpenAPI generation, and builds remain green.

## Immediately after

Add a local, account-free shortlist and comparison view for two to four
enriched courses. Compare workload, assessment, obligatory work,
collaboration, attendance, remote feasibility, and grade outcomes using the
same Fact and evidence semantics.

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
