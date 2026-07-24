# Active vertical slice: assessment signals while browsing

> Execution anchor: [`../product/scan-and-persist-design.md`](../product/scan-and-persist-design.md)

## Goal

Let a student scan a broad NTNU catalogue and see the first decision-relevant
signals without opening every result.

The browse-first catalogue, evidence-backed detail, HK-dir outcome strip, and
English/Norwegian interface are delivered on `main`. Preserve them as the
product path; add NTNU assessment/work signals without making the list wait for
detail enrichment.

## Required path

```text
Foldkit catalogue with URL state
  -> fast official NTNU result summaries
  -> delivered batched grade summaries for loaded course codes
  -> bounded NTNU detail enrichment for visible or shortlisted courses
  -> select a course
  -> existing CourseInsight detail and evidence
```

## Scope

1. Fetch NTNU detail only for visible, opened, or shortlisted courses, with a
   concurrency limit and cancellation for filters that change.
2. Derive compact assessment and obligatory-work signals through the existing
   evidence model; do not interpret catalogue multimedia as remote teaching or
   `examOnly` as an assessment claim.
3. Render semantic assessment icons with visible prose and accessible labels.
4. Keep initial official catalogue rows interactive while enrichments load or
   fail independently.
5. Preserve explicit unchecked, loading, known, inferred, conflicting,
   unavailable, and failed states in the Foldkit model.
6. Grow the assessment golden corpus to 10–20 observed courses spanning written,
   oral, home, project, portfolio, practical, assignment, and mixed assessment.
7. Measure visible-card enrichment before introducing D1 caching or a full
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
