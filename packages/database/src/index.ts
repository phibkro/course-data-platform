import type { CourseQuery, CourseRepositoryService } from '@course-data/application';
import { RepositoryError } from '@course-data/application';
import { decodeCourseSummary } from '@course-data/domain';
import * as Effect from 'effect/Effect';

export * from './curriculum';

interface CourseRow {
  readonly id: string;
  readonly course_id: string;
  readonly institution_id: string;
  readonly institution_short_name: string;
  readonly code: string;
  readonly title: string;
  readonly academic_year: number;
  readonly credits: number | null;
  readonly level: string;
  readonly teaching_language: string | null;
  readonly source_provider: string;
  readonly source_record_id: string;
  readonly source_retrieved_at: string;
}

const rowToCourse = (row: CourseRow) =>
  decodeCourseSummary({
    id: row.id,
    courseId: row.course_id,
    institutionId: row.institution_id,
    institutionShortName: row.institution_short_name,
    code: row.code,
    title: row.title,
    academicYear: row.academic_year,
    credits: row.credits,
    level: row.level,
    teachingLanguage: row.teaching_language,
    source: {
      provider: row.source_provider,
      recordId: row.source_record_id,
      retrievedAt: row.source_retrieved_at,
    },
  });

export const createD1CourseRepository = (database: D1Database): CourseRepositoryService => ({
  list: (query: CourseQuery) =>
    Effect.tryPromise({
      try: async () => {
        const clauses: Array<string> = [];
        const bindings: Array<string | number> = [];

        if (query.institutionId) {
          clauses.push('c.institution_id = ?');
          bindings.push(query.institutionId);
        }
        if (query.academicYear) {
          clauses.push('cv.academic_year = ?');
          bindings.push(query.academicYear);
        }
        if (query.search?.trim()) {
          clauses.push('(LOWER(c.code) LIKE ? OR LOWER(cv.title) LIKE ?)');
          const search = `%${query.search.trim().toLocaleLowerCase()}%`;
          bindings.push(search, search);
        }

        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        const statement = database.prepare(`
          WITH ranked_published_course_versions AS (
            SELECT
              cv.id, cv.course_id, cv.academic_year,
              snapshot.title, snapshot.credits, snapshot.level,
              snapshot.teaching_language, snapshot.source_provider,
              snapshot.source_record_id, snapshot.source_retrieved_at,
              ROW_NUMBER() OVER (
                PARTITION BY cv.id
                ORDER BY publication.published_at DESC, snapshot.revision_id DESC
              ) AS visibility_rank
            FROM dataset_revision_course_version snapshot
            JOIN dataset_publication publication
              ON publication.current_revision_id = snapshot.revision_id
            JOIN course_versions cv ON cv.id = snapshot.course_version_id
          ),
          visible_course_versions AS (
            SELECT
              id, course_id, academic_year, title, credits, level,
              teaching_language, source_provider, source_record_id, source_retrieved_at
            FROM ranked_published_course_versions
            WHERE visibility_rank = 1

            UNION ALL

            SELECT
              cv.id, cv.course_id, cv.academic_year,
              cv.title, cv.credits, cv.level, cv.teaching_language,
              cv.source_provider, cv.source_record_id, cv.source_retrieved_at
            FROM course_versions cv
            WHERE NOT EXISTS (
              SELECT 1
              FROM dataset_revision_course_version snapshot
              WHERE snapshot.course_version_id = cv.id
            )
          )
          SELECT DISTINCT
            cv.id,
            cv.course_id,
            c.institution_id,
            i.short_name AS institution_short_name,
            c.code,
            cv.title,
            cv.academic_year,
            cv.credits,
            cv.level,
            cv.teaching_language,
            cv.source_provider,
            cv.source_record_id,
            cv.source_retrieved_at
          FROM visible_course_versions cv
          JOIN courses c ON c.id = cv.course_id
          JOIN institutions i ON i.id = c.institution_id
          ${where}
          ORDER BY c.code ASC
          LIMIT 200
        `);

        const result = await statement.bind(...bindings).all<CourseRow>();
        return result.results.map(rowToCourse);
      },
      catch: (cause) =>
        new RepositoryError({
          operation: 'list courses',
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    }),
});
