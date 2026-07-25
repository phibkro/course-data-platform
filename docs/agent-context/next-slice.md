# Active vertical slice: local List, labels, and Compare

> Execution anchor:
> [`../product/list-collections-and-compare.md`](../product/list-collections-and-compare.md)

## Goal

Let a student preserve promising courses, organize them without duplicating
them, and compare meaningful differences without creating an account.

The browse-first catalogue, evidence-backed detail, HK-dir outcome strip,
English/Norwegian interface, and assessment/work scan signals are delivered on
`main` at `140e6dd`. Preserve them as the product path. List must reuse their
summary and Fact semantics rather than fork a second course model.

## Required path

```text
Explore or Inspect
  -> one-tap Save
  -> validated local saved identity
  -> List with notes and labels
  -> Any / All / Exclude collection view
  -> select two to four courses
  -> difference-first Compare
```

## Scope

1. Add a pure, versioned saved-state module that parses browser persistence as
   untrusted input and exposes explicit recovery.
2. Save or remove a stable course identity from Explore and Inspect without
   waiting for enrichment.
3. Activate `/list` in the shared sidebar/bottom navigation with a useful empty
   state, notes, and progressively refreshed saved summaries.
4. Add stable coloured labels and many-to-many memberships over the one saved
   set.
5. Implement bounded collection composition with included labels, Any/All
   matching, and excluded labels.
6. Select exactly two to four distinct saved courses and compare them using the
   existing decision and outcome grammar.
7. Preserve local state, URL state, source facts, and cached factual summaries
   as separate objects.

## Acceptance criteria

- A first-time student saves and compares two courses in under two minutes.
- Save is idempotent, one action, and survives reload.
- Corrupt or future local state is never silently accepted or discarded.
- A course can carry several labels without duplication.
- Any, All, and Exclude composition is deterministic and visibly restated.
- Removing a saved course atomically clears memberships and Compare selection.
- Unknown, unavailable, suppressed, conflicting, stale, and failed facts remain
  explicit in Compare.
- Provider failure and offline mode leave saved identities and student-authored
  state usable.
- Desktop keyboard and 375 px mobile journeys pass Agent Browser and axe tests.
- Type checks, lint, format, tests, OpenAPI generation, and builds remain green.

## Immediately after

Validate List and Compare with real course-selection tasks. In parallel, prove
one current NTNU timetable event contract through fixtures and provider
investigation; do not activate Schedule until its readiness gate in
[`../product/schedule-and-external-sync.md`](../product/schedule-and-external-sync.md)
is met.

## Still deferred

- programme compatibility and planning;
- authentication and cross-device sync;
- full catalogue replication and scheduled ingestion;
- second-institution support;
- discretionary design-system expansion.

## Design-system constraint

ADR-011 continues to freeze discretionary theme work. Reuse the existing
Material You semantic tokens and Foldkit primitives. Add visual machinery only
where saving, collection composition, or comparison needs it.
