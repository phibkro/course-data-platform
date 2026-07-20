PRAGMA foreign_keys = ON;

CREATE TABLE institutions (
  id TEXT PRIMARY KEY NOT NULL,
  short_name TEXT NOT NULL,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY NOT NULL,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  code TEXT NOT NULL,
  first_observed_year INTEGER NOT NULL,
  last_observed_year INTEGER,
  UNIQUE (institution_id, code)
);

CREATE TABLE course_versions (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  academic_year INTEGER NOT NULL,
  title TEXT NOT NULL,
  credits REAL,
  level TEXT NOT NULL,
  teaching_language TEXT,
  source_provider TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL,
  UNIQUE (course_id, academic_year)
);

CREATE INDEX course_versions_year_idx ON course_versions(academic_year);
CREATE INDEX course_versions_title_idx ON course_versions(title);

INSERT INTO institutions (id, short_name, name, country_code)
VALUES ('no.ntnu', 'NTNU', 'Norwegian University of Science and Technology', 'NO');

INSERT INTO courses (id, institution_id, code, first_observed_year)
VALUES
  ('no.ntnu:TDT4136', 'no.ntnu', 'TDT4136', 2026),
  ('no.ntnu:TTM4215', 'no.ntnu', 'TTM4215', 2026),
  ('no.ntnu:TDT4258', 'no.ntnu', 'TDT4258', 2026);

INSERT INTO course_versions (
  id, course_id, academic_year, title, credits, level, teaching_language,
  source_provider, source_record_id, source_retrieved_at
)
VALUES
  ('no.ntnu:TDT4136:2026', 'no.ntnu:TDT4136', 2026, 'Introduction to Artificial Intelligence', 7.5, 'bachelor', 'en', 'fixture', 'fixture:TDT4136:2026', '2026-07-20T00:00:00Z'),
  ('no.ntnu:TTM4215:2026', 'no.ntnu:TTM4215', 2026, 'Societal Security and Resilience', 7.5, 'master', 'en', 'fixture', 'fixture:TTM4215:2026', '2026-07-20T00:00:00Z'),
  ('no.ntnu:TDT4258:2026', 'no.ntnu:TDT4258', 2026, 'Low-Level Programming', 7.5, 'bachelor', 'en', 'fixture', 'fixture:TDT4258:2026', '2026-07-20T00:00:00Z');
