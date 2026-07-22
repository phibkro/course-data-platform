PRAGMA foreign_keys = ON;

-- The 0001 course rows were illustrative seeds, not publishable evidence.
-- Published programme snapshots retain any real course versions they reference.
DELETE FROM course_versions
WHERE source_provider = 'fixture';

DELETE FROM courses
WHERE id NOT IN (SELECT DISTINCT course_id FROM course_versions);

DELETE FROM institutions
WHERE id = 'no.ntnu'
  AND NOT EXISTS (SELECT 1 FROM courses WHERE institution_id = institutions.id);
