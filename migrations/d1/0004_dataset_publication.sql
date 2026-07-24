PRAGMA foreign_keys = ON;

CREATE TABLE dataset_revision (
  id TEXT PRIMARY KEY NOT NULL,
  source_provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  ingestion_run_id TEXT REFERENCES ingestion_run(id),
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('building', 'validated', 'published', 'rejected')),
  quality_report TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (source_provider, scope, content_hash)
);

CREATE TABLE dataset_publication (
  source_provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  current_revision_id TEXT NOT NULL REFERENCES dataset_revision(id),
  published_at TEXT NOT NULL,
  PRIMARY KEY (source_provider, scope)
);

CREATE INDEX dataset_revision_scope_idx
  ON dataset_revision(source_provider, scope, status);

ALTER TABLE programme_version
ADD COLUMN publication_revision_id TEXT REFERENCES dataset_revision(id);

CREATE TABLE dataset_revision_course_version (
  revision_id TEXT NOT NULL REFERENCES dataset_revision(id),
  course_version_id TEXT NOT NULL REFERENCES course_versions(id),
  title TEXT NOT NULL,
  credits REAL,
  level TEXT NOT NULL,
  teaching_language TEXT,
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL,
  PRIMARY KEY (revision_id, course_version_id)
);

CREATE INDEX dataset_revision_course_version_course_idx
  ON dataset_revision_course_version(course_version_id);

INSERT OR IGNORE INTO dataset_revision (
  id, source_provider, scope, ingestion_run_id, content_hash, observed_at,
  status, quality_report, rejection_reason, created_at, published_at
)
SELECT
  'revision:programme:' || pv.programme_id || ':' || pv.cohort_start_year || ':' || pv.data_revision,
  pv.source_provider,
  'programme:' || pv.programme_id || ':' || pv.cohort_start_year,
  ir.id,
  pv.content_hash,
  pv.observed_at,
  'published',
  '{"migration":"0004","quality":"legacy-published"}',
  NULL,
  pv.observed_at,
  pv.observed_at
FROM programme_version pv
LEFT JOIN ingestion_run ir ON ir.dataset_revision = pv.data_revision;

UPDATE programme_version
SET publication_revision_id =
  'revision:programme:' || programme_id || ':' || cohort_start_year || ':' || data_revision;

INSERT OR IGNORE INTO dataset_revision_course_version (
  revision_id, course_version_id, title, credits, level, teaching_language,
  source_provider, source_record_id, source_retrieved_at
)
SELECT
  pv.publication_revision_id,
  cv.id,
  cv.title,
  cv.credits,
  cv.level,
  cv.teaching_language,
  cv.source_provider,
  cv.source_record_id,
  cv.source_retrieved_at
FROM programme_version pv
JOIN programme_course_relation pcr ON pcr.programme_version_id = pv.id
JOIN course_versions cv ON cv.id = pcr.course_version_id
WHERE pv.publication_revision_id IS NOT NULL;

INSERT INTO dataset_publication (source_provider, scope, current_revision_id, published_at)
SELECT
  pv.source_provider,
  'programme:' || pv.programme_id || ':' || pv.cohort_start_year,
  pv.publication_revision_id,
  pv.observed_at
FROM programme_version pv
WHERE pv.publication_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM programme_version newer
    WHERE newer.programme_id = pv.programme_id
      AND newer.cohort_start_year = pv.cohort_start_year
      AND (
        newer.observed_at > pv.observed_at
        OR (newer.observed_at = pv.observed_at AND newer.id > pv.id)
      )
  );
