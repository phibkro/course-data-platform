CREATE TABLE replication_cursor (
  source_provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  cursor_at TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  PRIMARY KEY (source_provider, scope)
);

CREATE TABLE replication_run (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ntnu', 'dbh')),
  mode TEXT NOT NULL CHECK (mode IN ('incremental', 'full', 'periodic')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  expected_jobs INTEGER NOT NULL DEFAULT 0,
  succeeded_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE replication_job (
  run_id TEXT NOT NULL REFERENCES replication_run(id),
  job_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  attempted_at TEXT,
  completed_at TEXT,
  error TEXT,
  PRIMARY KEY (run_id, job_key)
);

CREATE TABLE source_freshness (
  source_provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  target_seconds INTEGER NOT NULL CHECK (target_seconds > 0),
  last_attempt_at TEXT,
  last_successful_publish_at TEXT,
  last_error TEXT,
  PRIMARY KEY (source_provider, scope)
);

CREATE INDEX replication_run_status_idx ON replication_run(status, started_at);
CREATE INDEX replication_job_status_idx ON replication_job(status, run_id);
