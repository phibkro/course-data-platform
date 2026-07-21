# ADR-007: Source replication, caching, and freshness

- Status: Accepted
- Date: 2026-07-20

## Context

NTNU and DBH/HK-dir have different update models. NTNU exposes a live catalogue with paging and incremental timestamps. DBH publishes periodic statistical snapshots through `https://dbh-data.dataporten-api.no/Tabeller/` and does not behave like a live change feed.

Treating D1 as a disposable HTTP cache would make provenance, reproducibility, offline use, and graceful upstream failure difficult.

## Decision

Use four explicit data layers:

1. R2 immutable evidence: exact upstream responses and source metadata.
2. D1 canonical replica: normalized temporal entities and published dataset revisions.
3. Cloudflare edge cache: response acceleration only.
4. Browser cache and IndexedDB: offline UX and local scenarios.

Publication is revision based. An ingestion run builds a candidate revision, validates quality gates, and atomically advances the current revision. Readers never observe a partially imported dataset.

### NTNU policy

- Initial and reconciliation scans use pages of 500 records.
- Incremental synchronization uses the source timestamp cursor with a small overlap window.
- The cursor advances to the run start time only after successful publication.
- Deleted entities close validity ranges or create tombstones; history is retained.
- A full reconciliation runs nightly.
- Target normal staleness is 15–20 minutes for lightweight current catalogue data.

### DBH policy

- Development starts with bounded JSON responses from the documented Dataporten endpoint.
- National and historical backfills may use streaming or bulk CSV.
- Responses and normalized records are content hashed.
- Latest reporting periods are checked daily and more frequently around reporting deadlines.
- Older periods are reconciled weekly or monthly.
- Target normal staleness is 24 hours after DBH publishes new data.

### API caching

Responses carry revision and observation metadata. ETags are derived from canonical query, dataset revision, and response schema version. Edge invalidation is an optimization, not a correctness requirement. TTL expiry and revision-aware ETags guarantee eventual freshness even if a purge fails.

## Consequences

The application can serve the last valid revision during upstream outages and state exactly how stale each source is. Full R2/D1/Queue implementation is deferred until programme-first workflows establish the highest-value data paths, but all new entities must reserve provenance and revision fields.
