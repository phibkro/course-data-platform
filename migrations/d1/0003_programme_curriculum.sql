PRAGMA foreign_keys = ON;

CREATE TABLE programme (
  id TEXT PRIMARY KEY NOT NULL,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  UNIQUE (institution_id, code)
);

CREATE TABLE programme_version (
  id TEXT PRIMARY KEY NOT NULL,
  programme_id TEXT NOT NULL REFERENCES programme(id),
  cohort_start_year INTEGER NOT NULL,
  start_season TEXT NOT NULL CHECK (start_season IN ('autumn', 'spring')),
  duration_terms INTEGER NOT NULL CHECK (duration_terms BETWEEN 1 AND 24),
  title TEXT NOT NULL,
  data_revision TEXT NOT NULL,
  relation_authority TEXT NOT NULL CHECK (
    relation_authority IN ('official', 'administrative', 'inferred', 'unresolved')
  ),
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  UNIQUE (programme_id, cohort_start_year, dataset_revision)
);

CREATE TABLE requirement_group (
  id TEXT PRIMARY KEY NOT NULL,
  programme_version_id TEXT NOT NULL REFERENCES programme_version(id),
  kind TEXT NOT NULL CHECK (kind IN ('required-courses', 'choose-n', 'minimum-credits')),
  title TEXT NOT NULL,
  choose_count INTEGER,
  minimum_credits REAL,
  evidence_ref TEXT NOT NULL,
  authority TEXT NOT NULL CHECK (
    authority IN ('official', 'administrative', 'inferred', 'unresolved')
  ),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT
);

CREATE TABLE requirement (
  id TEXT PRIMARY KEY NOT NULL,
  requirement_group_id TEXT NOT NULL REFERENCES requirement_group(id),
  course_version_id TEXT REFERENCES course_versions(id),
  position INTEGER NOT NULL,
  recommended_term_index INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  evidence_ref TEXT NOT NULL,
  authority TEXT NOT NULL CHECK (
    authority IN ('official', 'administrative', 'inferred', 'unresolved')
  ),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  UNIQUE (requirement_group_id, course_version_id)
);

CREATE TABLE programme_course_relation (
  id TEXT PRIMARY KEY NOT NULL,
  programme_version_id TEXT NOT NULL REFERENCES programme_version(id),
  course_version_id TEXT NOT NULL REFERENCES course_versions(id),
  relation_type TEXT NOT NULL CHECK (
    relation_type IN (
      'required-in-official-plan',
      'elective-in-official-plan',
      'recommended-in-official-plan',
      'primary-reporting-programme',
      'historically-taken',
      'semantically-similar',
      'unmapped'
    )
  ),
  authority TEXT NOT NULL CHECK (
    authority IN ('official', 'administrative', 'inferred', 'unresolved')
  ),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_ref TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  dataset_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  UNIQUE (
    programme_version_id,
    course_version_id,
    relation_type,
    authority,
    source_record_id
  )
);

CREATE INDEX programme_version_programme_idx ON programme_version(programme_id);
CREATE INDEX requirement_group_version_idx ON requirement_group(programme_version_id);
CREATE INDEX requirement_group_requirement_idx ON requirement(requirement_group_id);
CREATE INDEX programme_course_relation_version_idx ON programme_course_relation(programme_version_id);
CREATE INDEX programme_course_relation_authority_idx ON programme_course_relation(authority);
