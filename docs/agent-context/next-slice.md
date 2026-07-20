# Next vertical slice: programme context and editable roadmap

## Goal

Replace the illustrative roadmap fixture with one evidence-backed programme version and make the planning scenario editable and locally persistent.

## Required path

```text
bounded programme source fixture
  -> source decoder and relation authority
  -> programme version and requirement groups
  -> baseline scenario generation
  -> editable term placement
  -> deterministic kernel evaluation
  -> IndexedDB scenario persistence
  -> Plan and Workbench projections
```

## Scope

1. Import one bounded NTNU programme and cohort from official programme material, with DBH programme metadata where useful.
2. Preserve relation semantics: required, elective, recommended, administrative reporting relation, or inferred.
3. Add programme-first onboarding and automatic institution selection.
4. Add move-earlier, move-later, remove, restore, and clone operations to the Plan UI.
5. Store scenarios locally with schema version and data revision.
6. Re-evaluate immediately after every operation.
7. Show whether findings come from formal rules, workload policy, or incomplete source capability.
8. Expand Workbench from raw JSON to the first validated declarative-view specification.

## Acceptance criteria

- A user can select a programme and cohort without navigating faculty and department.
- The roadmap shows at least six terms and distinguishes required from elective positions.
- A course may be moved without being duplicated.
- Required-course and choose-N findings update deterministically.
- Refreshing the browser restores the scenario.
- A scenario can be cloned and exported as JSON.
- Every programme-course relation exposes authority and evidence.
- The UI clearly marks incomplete or fixture-derived curricula.
- TypeScript 7, TypeScript 6 compatibility, lint, format, tests, OpenAPI generation, and Worker/browser builds pass.

## Parallel research spike

Verify Feide OIDC and `groups-edu` capabilities for programme, cohort, field, and current-course context. Authentication is not placed on the critical path until a real FS-backed test response is observed.

## Deferred

- Full NTNU and DBH replication scheduling.
- FS GraphQL and academic results.
- Constraint-solver roadmap generation.
- Knowledge concepts, course-concept extraction, and personalized readiness.
