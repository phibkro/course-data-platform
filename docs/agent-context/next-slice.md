# Next vertical slice: DBH evidence ingestion

## Goal

Replace fixture catalogue records with a replayable ingestion path for one official DBH dataset while preserving raw evidence and explicit provenance.

## Scope

The slice covers one institution and a small bounded reporting period. It is a correctness spike, not a complete national import.

## Required path

```text
frozen DBH fixture
  -> source decoder
  -> validated source record
  -> raw evidence archive capability
  -> normalized course/course-version records
  -> idempotent D1 reconciliation
  -> existing GET /v1/courses endpoint
```

## New package boundaries

- `packages/source-dbh`: DBH-specific discovery, decoding, and normalization.
- `packages/evidence`: content hashes, raw-record identity, and archive capability.
- `packages/reconciliation`: deterministic comparison between observed and canonical records.
- `fixtures/dbh`: frozen source payloads and expected normalized output.

## Domain additions

- Explicit semester/reporting-period values.
- Source-record content hash.
- Ingestion-run identity and parser version.
- Data states for present, unavailable, suppressed, conflicting, and invalid source data.
- Immutable course-version revision identity.

## Acceptance criteria

1. No network access is required by tests.
2. The source fixture is archived before decoding.
3. Every normalized field carries source provenance.
4. Running the same input twice produces no duplicate canonical records.
5. A changed parser can replay the archived evidence.
6. Invalid records are quarantined with structured validation errors.
7. The API returns DBH-backed records without changing its public response shape.
8. Fixture, reconciliation, D1, transport, and migration tests pass.
9. No source adapter calls D1 directly.
10. No missing or suppressed value is represented as zero or false.

## Explicit non-goals

- Full historical grade import.
- Course similarity or embeddings.
- Multiple institution catalogue adapters.
- User accounts or synchronized preferences.
- Production scheduling.

## Decision gate after completion

Compare the DBH source shape against one institution-owned catalogue. Refine the canonical model only after both sources have exercised it.
