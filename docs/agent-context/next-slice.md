# Next vertical slice: evidence-backed programme data

## Goal

Replace the illustrative programme fixture without changing the programme-first onboarding, local scenario repository, planner operations, or declarative Workbench projection.

## Required path

```text
DBH programme metadata + official institution curriculum evidence
  -> raw source fixtures
  -> source-specific validation
  -> programme/version normalization
  -> requirement and relation authority mapping
  -> public programme catalogue API
  -> existing planner kernel and UI
```

## Scope

1. Add `packages/source-dbh` using the documented `dbh-data.dataporten-api.no/Tabeller/` host.
2. Commit bounded real fixtures for DBH programme table 347 and course table 208.
3. Add an NTNU programme adapter for one cohort's official curriculum structure.
4. Preserve each relation as official, administrative, inferred, or unresolved.
5. Add source-record, ingestion-run, rejection, and field-provenance tables.
6. Reconcile programme versions and requirement groups idempotently into D1.
7. Replace the planner fixture through the existing `/v1/programmes` and `/v1/planner/baseline` contracts.
8. Surface observed-at, source period, data revision, and incomplete-capability warnings.

## Acceptance criteria

- The current programme selector is populated from validated source fixtures rather than source-code constants.
- One NTNU programme version has an evidence-backed six-term roadmap.
- Official curriculum relations are distinguished from DBH reporting associations.
- Running ingestion twice produces no duplicate programme versions, courses, or relations.
- Rejected source records are stored with structured reasons.
- Existing saved scenarios continue to decode or receive an explicit data-revision warning.
- Programme onboarding, editing, IndexedDB persistence, import/export, and Workbench require no architecture changes.
- TypeScript 7, TypeScript 6 compatibility, lint, format, tests, OpenAPI generation, and Worker/browser builds pass.

## Parallel research spike

Verify Feide OIDC and `groups-edu` with a real FS-backed test identity. Record exact programme, cohort, field-of-study, and current-course group representations before adding authentication to the product path.

## Deferred

- Full national history and scheduled replication.
- FS GraphQL academic progress.
- Constraint-solver roadmap generation.
- Knowledge-concept extraction and personalized readiness.

## Design-system constraint

ADR-011 freezes discretionary theme work after the Theme Lab slice. The live appearance controls and shadcn preset commands are sufficient for experimentation. Continue with source-backed programme and course functionality unless an accessibility defect or concrete workflow gap requires a component change.
