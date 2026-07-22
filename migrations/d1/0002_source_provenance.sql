PRAGMA foreign_keys = ON;

CREATE TABLE ingestion_run (
  id TEXT PRIMARY KEY NOT NULL,
  source_provider TEXT NOT NULL,
  source_period TEXT,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL
);

CREATE TABLE source_record (
  id TEXT PRIMARY KEY NOT NULL,
  ingestion_run_id TEXT NOT NULL REFERENCES ingestion_run(id),
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_period TEXT,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  UNIQUE (source_provider, source_record_id, dataset_revision)
);

CREATE TABLE source_rejection (
  id TEXT PRIMARY KEY NOT NULL,
  ingestion_run_id TEXT NOT NULL REFERENCES ingestion_run(id),
  source_provider TEXT NOT NULL,
  source_record_id TEXT,
  source_period TEXT,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  rejection_code TEXT NOT NULL,
  rejection_message TEXT NOT NULL,
  raw_payload TEXT NOT NULL
);

CREATE TABLE field_provenance (
  id TEXT PRIMARY KEY NOT NULL,
  source_record_row_id TEXT NOT NULL REFERENCES source_record(id),
  ingestion_run_id TEXT NOT NULL REFERENCES ingestion_run(id),
  field_name TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_period TEXT,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  UNIQUE (source_record_row_id, field_name)
);

CREATE INDEX source_record_run_idx ON source_record(ingestion_run_id);
CREATE INDEX source_rejection_run_idx ON source_rejection(ingestion_run_id);
CREATE INDEX field_provenance_record_idx ON field_provenance(source_record_row_id);
