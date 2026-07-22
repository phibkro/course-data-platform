import {
  ProgrammeVersionNotFoundError,
  RepositoryError,
  type ProgrammeCurriculumRepositoryService,
  type ProgrammeVersionListRow,
} from '@course-data/application';
import type { Rejection, ValidatedDbhRecord } from '@course-data/source-dbh';
import type { NtnuRejection, ValidatedNtnuCurriculum } from '@course-data/source-ntnu';
import { decodeProgrammeVersion } from '@course-data/study-kernel';
import * as Effect from 'effect/Effect';

export interface NtnuCurriculumReconciliationInput {
  readonly curriculum: ValidatedNtnuCurriculum;
  readonly curriculumRejections?: ReadonlyArray<NtnuRejection>;
  readonly dbhProgrammeRecords: ReadonlyArray<ValidatedDbhRecord>;
  readonly dbhCourseRecords: ReadonlyArray<ValidatedDbhRecord>;
  readonly dbhRejections: ReadonlyArray<Rejection>;
}

export interface ReconciliationReport {
  readonly ingestionRunId: string;
  readonly programmeVersionId: string;
  readonly dataRevision: string;
}

export interface PublicationCandidate {
  readonly revisionId: string;
  readonly scope: string;
  readonly programmeVersionId: string;
  readonly dataRevision: string;
}

export interface ProgrammeCurriculumRepositoryOptions {
  readonly beforePublish?: (candidate: PublicationCandidate) => Promise<void>;
}

export interface ProgrammeCurriculumRepository extends ProgrammeCurriculumRepositoryService {
  readonly reconcile: (
    input: NtnuCurriculumReconciliationInput,
  ) => Effect.Effect<ReconciliationReport, RepositoryError>;
}

type Authority = 'official' | 'administrative' | 'inferred' | 'unresolved';

interface CourseModel {
  readonly id: string;
  readonly courseId: string;
  readonly code: string;
  readonly academicYear: number;
  readonly title: string;
  readonly credits: number | null;
  readonly level: string;
  readonly teachingLanguage: string | null;
  readonly sourceProvider: string;
  readonly sourceRecordId: string;
  readonly observedAt: string;
}

interface GroupModel {
  readonly id: string;
  readonly kind: 'required-courses' | 'choose-n' | 'minimum-credits';
  readonly title: string;
  readonly chooseCount: number | null;
  readonly minimumCredits: number | null;
  readonly sourceRecordId: string;
  readonly contentHash: string;
}

interface RequirementModel {
  readonly id: string;
  readonly groupId: string;
  readonly courseVersionId: string;
  readonly position: number;
  readonly recommendedTermIndex: number;
  readonly isDefault: boolean;
  readonly sourceRecordId: string;
  readonly contentHash: string;
}

interface RelationModel {
  readonly id: string;
  readonly courseVersionId: string;
  readonly relationType:
    | 'required-in-official-plan'
    | 'elective-in-official-plan'
    | 'recommended-in-official-plan'
    | 'primary-reporting-programme';
  readonly authority: Authority;
  readonly confidence: number;
  readonly evidenceRef: string;
  readonly sourceProvider: string;
  readonly sourceRecordId: string;
  readonly datasetRevision: string;
  readonly contentHash: string;
  readonly observedAt: string;
}

interface ReconciliationModel {
  readonly programmeId: string;
  readonly programmeVersionId: string;
  readonly dataRevision: string;
  readonly publicationScope: string;
  readonly publicationRevisionId: string;
  readonly courses: ReadonlyArray<CourseModel>;
  readonly groups: ReadonlyArray<GroupModel>;
  readonly requirements: ReadonlyArray<RequirementModel>;
  readonly relations: ReadonlyArray<RelationModel>;
}

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
};

const sha256 = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const knownString = (record: ValidatedDbhRecord, field: string): string | undefined => {
  const value = record.fields[field]?.value;
  return value?.state === 'known' && typeof value.value === 'string' ? value.value : undefined;
};

const attributionOf = (record: ValidatedDbhRecord) => Object.values(record.fields)[0]?.attribution;

const academicYearForTerm = (
  cohortStartYear: number,
  startSeason: 'autumn' | 'spring',
  termIndex: number,
): number =>
  startSeason === 'autumn'
    ? cohortStartYear + Math.floor((termIndex + 1) / 2)
    : cohortStartYear + Math.floor(termIndex / 2);

const choiceCount = (choiceCode: string): number | null => {
  if (choiceCode === 'M') return 1;
  const match = /^M(\d+)A?$/.exec(choiceCode);
  return match?.[1] === undefined ? null : Number(match[1]);
};

export const buildNtnuReconciliationModel = async (
  input: NtnuCurriculumReconciliationInput,
): Promise<ReconciliationModel> => {
  const { curriculum } = input;
  const programmeId = `no.ntnu:${curriculum.programmeCode}`;
  const dataRevision = `ntnu:${curriculum.attribution.contentHash}`;
  const programmeVersionId = `${programmeId}:${curriculum.cohortStartYear}:${curriculum.attribution.contentHash.slice(0, 16)}`;
  const publicationScope = `programme:${programmeId}:${curriculum.cohortStartYear}`;
  const publicationRevisionId = `revision:${publicationScope}:${dataRevision}`;
  const courses = new Map<string, CourseModel>();
  const groups = new Map<string, GroupModel>();
  const requirements: RequirementModel[] = [];
  const relations: RelationModel[] = [];
  let position = 0;

  for (const period of curriculum.periods) {
    const academicYear = academicYearForTerm(
      curriculum.cohortStartYear,
      curriculum.startSeason,
      period.termIndex,
    );
    for (const group of period.groups) {
      const firstChoice = group.courses[0]?.choiceCode;
      const count = firstChoice === undefined ? null : choiceCount(firstChoice);
      const groupKind =
        firstChoice === 'O' ? 'required-courses' : count === null ? null : 'choose-n';
      const groupId = `${programmeVersionId}:group:${group.code}`;
      if (groupKind !== null && !groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          kind: groupKind,
          title: group.title,
          chooseCount: groupKind === 'choose-n' ? count : null,
          minimumCredits: null,
          sourceRecordId: curriculum.sourceRecordId,
          contentHash: await sha256({ group: group.code, title: group.title, choice: firstChoice }),
        });
      }

      for (const course of group.courses) {
        const courseId = `no.ntnu:${course.code}`;
        const courseVersionId = `${courseId}:${academicYear}`;
        if (!courses.has(courseVersionId)) {
          courses.set(courseVersionId, {
            id: courseVersionId,
            courseId,
            code: course.code,
            academicYear,
            title: course.title,
            credits: course.credits,
            level: 'unknown',
            teachingLanguage: null,
            sourceProvider: curriculum.attribution.provider,
            sourceRecordId: curriculum.sourceRecordId,
            observedAt: curriculum.attribution.retrievedAt,
          });
        }
        const relationType =
          course.choiceCode === 'O'
            ? 'required-in-official-plan'
            : course.choiceCode === 'VA'
              ? 'recommended-in-official-plan'
              : 'elective-in-official-plan';
        relations.push({
          id: `${programmeVersionId}:relation:official:${courseVersionId}:${relationType}`,
          courseVersionId,
          relationType,
          authority: 'official',
          confidence: 1,
          evidenceRef: curriculum.attribution.requestUrl,
          sourceProvider: curriculum.attribution.provider,
          sourceRecordId: curriculum.sourceRecordId,
          datasetRevision: curriculum.attribution.datasetRevision,
          contentHash: await sha256({ course, period: period.termIndex, group: group.code }),
          observedAt: curriculum.attribution.retrievedAt,
        });
        if (groupKind !== null && course.choiceCode !== 'VA') {
          requirements.push({
            id: `${groupId}:requirement:${courseVersionId}`,
            groupId,
            courseVersionId,
            position: position++,
            recommendedTermIndex: period.termIndex,
            isDefault: false,
            sourceRecordId: curriculum.sourceRecordId,
            contentHash: await sha256({ course, period: period.termIndex, group: group.code }),
          });
        }
      }
    }
  }

  for (const record of input.dbhCourseRecords) {
    if (knownString(record, 'Studieprogramkode') !== curriculum.programmeCode) continue;
    const rawCode = knownString(record, 'Emnekode');
    const year = Number(knownString(record, 'Årstall'));
    if (rawCode === undefined || !Number.isInteger(year)) continue;
    const code = rawCode.replace(/-\d+$/, '');
    const courseId = `no.ntnu:${code}`;
    const courseVersionId = `${courseId}:${year}`;
    const attribution = attributionOf(record);
    if (attribution === undefined) continue;
    if (!courses.has(courseVersionId)) {
      courses.set(courseVersionId, {
        id: courseVersionId,
        courseId,
        code,
        academicYear: year,
        title: knownString(record, 'Emnenavn') ?? code,
        credits: Number(knownString(record, 'Studiepoeng')),
        level: 'unknown',
        teachingLanguage: knownString(record, 'Underv.språk') ?? null,
        sourceProvider: attribution.provider,
        sourceRecordId: record.sourceRecordId,
        observedAt: attribution.retrievedAt,
      });
    }
    relations.push({
      id: `${programmeVersionId}:relation:administrative:${courseVersionId}:${record.sourceRecordId}`,
      courseVersionId,
      relationType: 'primary-reporting-programme',
      authority: 'administrative',
      confidence: 1,
      evidenceRef: `dbh:table-208:${record.sourceRecordId}`,
      sourceProvider: attribution.provider,
      sourceRecordId: record.sourceRecordId,
      datasetRevision: attribution.datasetRevision,
      contentHash: await sha256(record.raw),
      observedAt: attribution.retrievedAt,
    });
  }

  return {
    programmeId,
    programmeVersionId,
    dataRevision,
    publicationScope,
    publicationRevisionId,
    courses: [...courses.values()],
    groups: [...groups.values()],
    requirements,
    relations,
  };
};

const chunks = <A>(values: ReadonlyArray<A>, size: number): ReadonlyArray<ReadonlyArray<A>> => {
  const result: Array<ReadonlyArray<A>> = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const runBatches = async (
  database: D1Database,
  statements: ReadonlyArray<D1PreparedStatement>,
): Promise<void> => {
  for (const batch of chunks(statements, 50)) {
    if (batch.length > 0) await database.batch([...batch]);
  }
};

interface ProgrammeVersionRow {
  readonly id: string;
  readonly programme_id: string;
  readonly institution_id: string;
  readonly institution_short_name: string;
  readonly title: string;
  readonly cohort_start_year: number;
  readonly start_season: 'autumn' | 'spring';
  readonly duration_terms: number;
  readonly data_revision: string;
  readonly relation_authority: 'official' | 'administrative' | 'inferred';
}

interface ProgrammeVersionListDbRow {
  readonly programme_id: string;
  readonly programme_version_id: string;
  readonly institution_id: string;
  readonly institution_short_name: string;
  readonly title: string;
  readonly cohort_start_year: number;
  readonly start_season: 'autumn' | 'spring';
  readonly duration_terms: number;
  readonly relation_authority: string;
  readonly data_revision: string;
  readonly observed_at: string | null;
  readonly source_period: string | null;
}

const toProgrammeVersionListRow = (row: ProgrammeVersionListDbRow): ProgrammeVersionListRow => {
  if (
    row.relation_authority !== 'official' &&
    row.relation_authority !== 'administrative' &&
    row.relation_authority !== 'inferred'
  ) {
    throw new Error(`Unsupported programme relation authority: ${row.relation_authority}`);
  }
  return {
    programmeId: row.programme_id,
    programmeVersionId: row.programme_version_id,
    institutionId: row.institution_id,
    institutionShortName: row.institution_short_name,
    title: row.title,
    cohortStartYear: row.cohort_start_year,
    startSeason: row.start_season,
    durationTerms: row.duration_terms,
    relationAuthority: row.relation_authority,
    dataRevision: row.data_revision,
    observedAt: row.observed_at,
    sourcePeriod: row.source_period,
  };
};

interface RequirementGroupRow {
  readonly id: string;
  readonly kind: 'required-courses' | 'choose-n' | 'minimum-credits';
  readonly title: string;
  readonly choose_count: number | null;
  readonly minimum_credits: number | null;
  readonly evidence_ref: string;
}

interface RequirementRow {
  readonly id: string;
  readonly requirement_group_id: string;
  readonly course_version_id: string | null;
  readonly code: string | null;
  readonly title: string | null;
  readonly credits: number | null;
  readonly recommended_term_index: number | null;
  readonly is_default: number;
  readonly evidence_ref: string;
}

export const createD1ProgrammeCurriculumRepository = (
  database: D1Database,
  options: ProgrammeCurriculumRepositoryOptions = {},
): ProgrammeCurriculumRepository => ({
  reconcile: (input) =>
    Effect.tryPromise({
      try: async () => {
        const model = await buildNtnuReconciliationModel(input);
        const observedAt = input.curriculum.attribution.retrievedAt;
        const runId = `ingestion:ntnu:${input.curriculum.programmeCode}:${input.curriculum.cohortStartYear}:${input.curriculum.attribution.contentHash}`;
        await database
          .prepare(
            `INSERT OR IGNORE INTO ingestion_run (
              id, source_provider, source_period, dataset_revision, content_hash,
              observed_at, started_at, completed_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'running')`,
          )
          .bind(
            runId,
            'course-data-reconciliation',
            String(input.curriculum.cohortStartYear),
            model.dataRevision,
            input.curriculum.attribution.contentHash,
            observedAt,
            observedAt,
          )
          .run();
        await database
          .prepare(
            `INSERT OR IGNORE INTO dataset_revision (
              id, source_provider, scope, ingestion_run_id, content_hash, observed_at,
              status, quality_report, rejection_reason, created_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'building', NULL, NULL, ?, NULL)`,
          )
          .bind(
            model.publicationRevisionId,
            input.curriculum.attribution.provider,
            model.publicationScope,
            runId,
            input.curriculum.attribution.contentHash,
            observedAt,
            observedAt,
          )
          .run();
        const candidateStatus = await database
          .prepare(`SELECT status FROM dataset_revision WHERE id = ?`)
          .bind(model.publicationRevisionId)
          .first<{ readonly status: string }>();
        if (candidateStatus === null) {
          throw new Error('Candidate revision could not be created.');
        }
        if (candidateStatus.status === 'rejected') {
          throw new Error(
            'This content-identical candidate was already rejected by quality gates.',
          );
        }

        const statements: D1PreparedStatement[] = [];
        const acceptedDbh = [...input.dbhProgrammeRecords, ...input.dbhCourseRecords];
        for (const record of acceptedDbh) {
          const attribution = attributionOf(record);
          if (attribution === undefined) continue;
          const sourceRowId = `source:${attribution.provider}:${record.sourceRecordId}:${attribution.datasetRevision}`;
          const recordHash = await sha256(record.raw);
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO source_record (
                  id, ingestion_run_id, source_provider, source_record_id, source_period,
                  dataset_revision, content_hash, observed_at, raw_payload
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                sourceRowId,
                runId,
                attribution.provider,
                record.sourceRecordId,
                `${attribution.sourcePeriod.year}:${attribution.sourcePeriod.semester}`,
                attribution.datasetRevision,
                recordHash,
                attribution.retrievedAt,
                JSON.stringify(record.raw),
              ),
          );
          for (const [fieldName, field] of Object.entries(record.fields)) {
            statements.push(
              database
                .prepare(
                  `INSERT OR IGNORE INTO field_provenance (
                    id, source_record_row_id, ingestion_run_id, field_name, source_provider,
                    source_record_id, source_period, dataset_revision, content_hash, observed_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                  `${sourceRowId}:field:${encodeURIComponent(fieldName)}`,
                  sourceRowId,
                  runId,
                  fieldName,
                  field.attribution.provider,
                  record.sourceRecordId,
                  `${field.attribution.sourcePeriod.year}:${field.attribution.sourcePeriod.semester}`,
                  field.attribution.datasetRevision,
                  recordHash,
                  field.attribution.retrievedAt,
                ),
            );
          }
        }

        const curriculumSourceId = `source:${input.curriculum.attribution.provider}:${input.curriculum.sourceRecordId}:${input.curriculum.attribution.datasetRevision}`;
        const curriculumRecordHash = await sha256(input.curriculum.raw);
        statements.push(
          database
            .prepare(
              `INSERT OR IGNORE INTO source_record (
                id, ingestion_run_id, source_provider, source_record_id, source_period,
                dataset_revision, content_hash, observed_at, raw_payload
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              curriculumSourceId,
              runId,
              input.curriculum.attribution.provider,
              input.curriculum.sourceRecordId,
              input.curriculum.attribution.sourcePeriod,
              input.curriculum.attribution.datasetRevision,
              curriculumRecordHash,
              observedAt,
              JSON.stringify(input.curriculum.raw),
            ),
        );
        for (const [fieldName, field] of Object.entries(input.curriculum.fields)) {
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO field_provenance (
                  id, source_record_row_id, ingestion_run_id, field_name, source_provider,
                  source_record_id, source_period, dataset_revision, content_hash, observed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                `${curriculumSourceId}:field:${encodeURIComponent(fieldName)}`,
                curriculumSourceId,
                runId,
                fieldName,
                field.attribution.provider,
                input.curriculum.sourceRecordId,
                field.attribution.sourcePeriod,
                field.attribution.datasetRevision,
                curriculumRecordHash,
                field.attribution.retrievedAt,
              ),
          );
        }

        const dbhRevisionByTable = new Map<number, string>();
        for (const record of acceptedDbh) {
          const attribution = attributionOf(record);
          if (attribution !== undefined) {
            dbhRevisionByTable.set(record.tableId, attribution.datasetRevision);
          }
        }
        for (const rejection of input.dbhRejections) {
          const revision = dbhRevisionByTable.get(rejection.tableId) ?? model.dataRevision;
          const rejectionHash = await sha256(rejection.raw);
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO source_rejection (
                  id, ingestion_run_id, source_provider, source_record_id, source_period,
                  dataset_revision, content_hash, observed_at, rejection_code,
                  rejection_message, raw_payload
                ) VALUES (?, ?, 'dbh', ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                `rejection:dbh:${rejection.tableId}:${rejection.rowIdentity}:${revision}`,
                runId,
                rejection.rowIdentity,
                String(input.curriculum.cohortStartYear),
                revision,
                rejectionHash,
                observedAt,
                rejection.code,
                rejection.message,
                JSON.stringify(rejection.raw),
              ),
          );
        }
        for (const rejection of input.curriculumRejections ?? []) {
          const rejectionHash = await sha256(rejection.raw);
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO source_rejection (
                  id, ingestion_run_id, source_provider, source_record_id, source_period,
                  dataset_revision, content_hash, observed_at, rejection_code,
                  rejection_message, raw_payload
                ) VALUES (?, ?, 'ntnu-studyplan', ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                `rejection:ntnu:${rejection.sourceRecordId}:${input.curriculum.attribution.datasetRevision}`,
                runId,
                rejection.sourceRecordId,
                input.curriculum.attribution.sourcePeriod,
                input.curriculum.attribution.datasetRevision,
                rejectionHash,
                observedAt,
                rejection.code,
                rejection.message,
                JSON.stringify(rejection.raw),
              ),
          );
        }

        statements.push(
          database
            .prepare(
              `INSERT OR IGNORE INTO programme (
                id, institution_id, code, title, source_provider, source_record_id,
                dataset_revision, content_hash, observed_at, valid_from, valid_to
              ) VALUES (?, 'no.ntnu', ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            )
            .bind(
              model.programmeId,
              input.curriculum.programmeCode,
              input.curriculum.title,
              input.curriculum.attribution.provider,
              input.curriculum.sourceRecordId,
              input.curriculum.attribution.datasetRevision,
              curriculumRecordHash,
              observedAt,
              `${input.curriculum.cohortStartYear}-01-01`,
            ),
          database
            .prepare(
              `INSERT OR IGNORE INTO programme_version (
                id, programme_id, cohort_start_year, start_season, duration_terms, title,
                data_revision, relation_authority, source_provider, source_record_id,
                dataset_revision, content_hash, observed_at, valid_from, valid_to,
                publication_revision_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'official', ?, ?, ?, ?, ?, ?, NULL, ?)`,
            )
            .bind(
              model.programmeVersionId,
              model.programmeId,
              input.curriculum.cohortStartYear,
              input.curriculum.startSeason,
              input.curriculum.durationTerms,
              input.curriculum.title,
              model.dataRevision,
              input.curriculum.attribution.provider,
              input.curriculum.sourceRecordId,
              input.curriculum.attribution.datasetRevision,
              curriculumRecordHash,
              observedAt,
              `${input.curriculum.cohortStartYear}-01-01`,
              model.publicationRevisionId,
            ),
        );

        for (const course of model.courses) {
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO courses (
                  id, institution_id, code, first_observed_year, last_observed_year
                ) VALUES (?, 'no.ntnu', ?, ?, NULL)`,
              )
              .bind(course.courseId, course.code, course.academicYear),
            database
              .prepare(
                `INSERT INTO course_versions (
                  id, course_id, academic_year, title, credits, level, teaching_language,
                  source_provider, source_record_id, source_retrieved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(course_id, academic_year) DO UPDATE SET
                  title = excluded.title,
                  credits = excluded.credits,
                  level = excluded.level,
                  teaching_language = excluded.teaching_language,
                  source_provider = excluded.source_provider,
                  source_record_id = excluded.source_record_id,
                  source_retrieved_at = excluded.source_retrieved_at
                WHERE excluded.source_provider = 'ntnu-studyplan'
                  AND course_versions.source_provider <> 'ntnu-studyplan'`,
              )
              .bind(
                course.id,
                course.courseId,
                course.academicYear,
                course.title,
                course.credits,
                course.level,
                course.teachingLanguage,
                course.sourceProvider,
                course.sourceRecordId,
                course.observedAt,
              ),
            database
              .prepare(
                `INSERT OR IGNORE INTO dataset_revision_course_version (
                  revision_id, course_version_id, title, credits, level, teaching_language,
                  source_provider, source_record_id, source_retrieved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                model.publicationRevisionId,
                course.id,
                course.title,
                course.credits,
                course.level,
                course.teachingLanguage,
                course.sourceProvider,
                course.sourceRecordId,
                course.observedAt,
              ),
          );
        }
        for (const group of model.groups) {
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO requirement_group (
                  id, programme_version_id, kind, title, choose_count, minimum_credits,
                  evidence_ref, authority, confidence, source_provider, source_record_id,
                  dataset_revision, content_hash, observed_at, valid_from, valid_to
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'official', 1, ?, ?, ?, ?, ?, ?, NULL)`,
              )
              .bind(
                group.id,
                model.programmeVersionId,
                group.kind,
                group.title,
                group.chooseCount,
                group.minimumCredits,
                input.curriculum.attribution.requestUrl,
                input.curriculum.attribution.provider,
                group.sourceRecordId,
                input.curriculum.attribution.datasetRevision,
                group.contentHash,
                observedAt,
                `${input.curriculum.cohortStartYear}-01-01`,
              ),
          );
        }
        for (const requirement of model.requirements) {
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO requirement (
                  id, requirement_group_id, course_version_id, position,
                  recommended_term_index, is_default, evidence_ref, authority, confidence,
                  source_provider, source_record_id, dataset_revision, content_hash,
                  observed_at, valid_from, valid_to
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'official', 1, ?, ?, ?, ?, ?, ?, NULL)`,
              )
              .bind(
                requirement.id,
                requirement.groupId,
                requirement.courseVersionId,
                requirement.position,
                requirement.recommendedTermIndex,
                requirement.isDefault ? 1 : 0,
                input.curriculum.attribution.requestUrl,
                input.curriculum.attribution.provider,
                requirement.sourceRecordId,
                input.curriculum.attribution.datasetRevision,
                requirement.contentHash,
                observedAt,
                `${input.curriculum.cohortStartYear}-01-01`,
              ),
          );
        }
        for (const relation of model.relations) {
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO programme_course_relation (
                  id, programme_version_id, course_version_id, relation_type, authority,
                  confidence, evidence_ref, source_provider, source_record_id,
                  dataset_revision, content_hash, observed_at, valid_from, valid_to
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
              )
              .bind(
                relation.id,
                model.programmeVersionId,
                relation.courseVersionId,
                relation.relationType,
                relation.authority,
                relation.confidence,
                relation.evidenceRef,
                relation.sourceProvider,
                relation.sourceRecordId,
                relation.datasetRevision,
                relation.contentHash,
                relation.observedAt,
                `${input.curriculum.cohortStartYear}-01-01`,
              ),
          );
        }

        await runBatches(database, statements);

        const qualityReport = {
          programmeVersions: 1,
          courses: model.courses.length,
          groups: model.groups.length,
          requirements: model.requirements.length,
          relations: model.relations.length,
          curriculumRejections: input.curriculumRejections?.length ?? 0,
          passed:
            model.courses.length > 0 &&
            model.groups.length > 0 &&
            model.requirements.length > 0 &&
            (input.curriculumRejections?.length ?? 0) === 0,
        };
        const qualityJson = stableJson(qualityReport);
        if (!qualityReport.passed) {
          const reason = 'Candidate failed the official-curriculum completeness gate.';
          await database.batch([
            database
              .prepare(
                `UPDATE dataset_revision
                 SET status = 'rejected', quality_report = ?, rejection_reason = ?
                 WHERE id = ? AND status <> 'published'`,
              )
              .bind(qualityJson, reason, model.publicationRevisionId),
            database
              .prepare(
                `UPDATE ingestion_run
                 SET status = 'rejected', completed_at = ?
                 WHERE id = ? AND status <> 'completed'`,
              )
              .bind(observedAt, runId),
          ]);
          throw new Error(reason);
        }

        await database
          .prepare(
            `UPDATE dataset_revision
             SET status = 'validated', quality_report = ?, rejection_reason = NULL
             WHERE id = ? AND status = 'building'`,
          )
          .bind(qualityJson, model.publicationRevisionId)
          .run();

        await options.beforePublish?.({
          revisionId: model.publicationRevisionId,
          scope: model.publicationScope,
          programmeVersionId: model.programmeVersionId,
          dataRevision: model.dataRevision,
        });

        await database.batch([
          database
            .prepare(
              `UPDATE dataset_revision
               SET status = 'published', quality_report = ?, rejection_reason = NULL,
                   published_at = COALESCE(published_at, ?)
               WHERE id = ? AND status IN ('validated', 'published')`,
            )
            .bind(qualityJson, observedAt, model.publicationRevisionId),
          database
            .prepare(
              `INSERT INTO dataset_publication (
                 source_provider, scope, current_revision_id, published_at
               )
               SELECT ?, ?, ?, ?
               WHERE EXISTS (
                 SELECT 1 FROM dataset_revision
                 WHERE id = ? AND status = 'published'
               )
               ON CONFLICT(source_provider, scope) DO UPDATE SET
                 current_revision_id = excluded.current_revision_id,
                 published_at = excluded.published_at`,
            )
            .bind(
              input.curriculum.attribution.provider,
              model.publicationScope,
              model.publicationRevisionId,
              observedAt,
              model.publicationRevisionId,
            ),
          database
            .prepare(
              `UPDATE ingestion_run
               SET status = 'completed', completed_at = ?
               WHERE id = ? AND status <> 'completed'`,
            )
            .bind(observedAt, runId),
        ]);
        return {
          ingestionRunId: runId,
          programmeVersionId: model.programmeVersionId,
          dataRevision: model.dataRevision,
        };
      },
      catch: (cause) =>
        new RepositoryError({
          operation: 'reconcile NTNU curriculum',
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    }),
  listProgrammeVersions: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await database
          .prepare(
            `SELECT p.id AS programme_id, pv.id AS programme_version_id,
                    p.institution_id, i.short_name AS institution_short_name,
                    pv.title, pv.cohort_start_year, pv.start_season,
                    pv.duration_terms, pv.relation_authority, pv.data_revision,
                    pv.observed_at, sr.source_period
             FROM programme_version pv
             JOIN dataset_publication dp
               ON dp.current_revision_id = pv.publication_revision_id
             JOIN programme p ON p.id = pv.programme_id
             JOIN institutions i ON i.id = p.institution_id
             LEFT JOIN source_record sr
               ON sr.source_provider = pv.source_provider
              AND sr.source_record_id = pv.source_record_id
              AND sr.dataset_revision = pv.dataset_revision
             ORDER BY pv.cohort_start_year DESC, pv.id`,
          )
          .all<ProgrammeVersionListDbRow>();
        return rows.results.map(toProgrammeVersionListRow);
      },
      catch: (cause) =>
        new RepositoryError({
          operation: 'list programme versions',
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    }),
  getProgrammeVersion: (programmeVersionId) =>
    Effect.tryPromise({
      try: async () => {
        const version = await database
          .prepare(
            `SELECT pv.id, pv.programme_id, p.institution_id,
                    i.short_name AS institution_short_name, pv.title,
                    pv.cohort_start_year, pv.start_season, pv.duration_terms,
                    pv.data_revision, pv.relation_authority
             FROM programme_version pv
             JOIN dataset_publication dp
               ON dp.current_revision_id = pv.publication_revision_id
             JOIN programme p ON p.id = pv.programme_id
             JOIN institutions i ON i.id = p.institution_id
             WHERE pv.id = ?`,
          )
          .bind(programmeVersionId)
          .first<ProgrammeVersionRow>();
        if (version === null) throw new ProgrammeVersionNotFoundError({ programmeVersionId });

        const groupRows = await database
          .prepare(
            `SELECT id, kind, title, choose_count, minimum_credits, evidence_ref
             FROM requirement_group
             WHERE programme_version_id = ?
             ORDER BY id`,
          )
          .bind(programmeVersionId)
          .all<RequirementGroupRow>();
        const requirementRows = await database
          .prepare(
            `SELECT r.id, r.requirement_group_id, r.course_version_id,
                    c.code, COALESCE(snapshot.title, cv.title) AS title,
                    COALESCE(snapshot.credits, cv.credits) AS credits,
                    r.recommended_term_index,
                    r.is_default, r.evidence_ref
             FROM requirement r
             LEFT JOIN course_versions cv ON cv.id = r.course_version_id
             LEFT JOIN courses c ON c.id = cv.course_id
             JOIN requirement_group rg ON rg.id = r.requirement_group_id
             JOIN programme_version pv ON pv.id = rg.programme_version_id
             LEFT JOIN dataset_revision_course_version snapshot
               ON snapshot.revision_id = pv.publication_revision_id
              AND snapshot.course_version_id = r.course_version_id
             WHERE rg.programme_version_id = ?
             ORDER BY r.position, r.id`,
          )
          .bind(programmeVersionId)
          .all<RequirementRow>();

        const rowsByGroup = new Map<string, RequirementRow[]>();
        for (const row of requirementRows.results) {
          const rows = rowsByGroup.get(row.requirement_group_id) ?? [];
          rows.push(row);
          rowsByGroup.set(row.requirement_group_id, rows);
        }
        const requirements: unknown[] = [];
        for (const group of groupRows.results) {
          const rows = rowsByGroup.get(group.id) ?? [];
          if (group.kind === 'required-courses') {
            for (const row of rows) {
              requirements.push({
                kind: 'required-course',
                id: row.id,
                title: row.title ?? group.title,
                course: {
                  courseVersionId: row.course_version_id,
                  code: row.code,
                  title: row.title,
                  credits: row.credits,
                  recommendedTermIndex: row.recommended_term_index,
                },
                evidenceRefs: [row.evidence_ref],
              });
            }
          } else if (group.kind === 'choose-n') {
            requirements.push({
              kind: 'choose-n',
              id: group.id,
              title: group.title,
              choose: group.choose_count,
              options: rows.map((row) => ({
                courseVersionId: row.course_version_id,
                code: row.code,
                title: row.title,
                credits: row.credits,
                recommendedTermIndex: row.recommended_term_index,
              })),
              defaultCourseVersionIds: rows
                .filter((row) => row.is_default === 1)
                .map((row) => row.course_version_id),
              evidenceRefs: [group.evidence_ref],
            });
          } else {
            requirements.push({
              kind: 'minimum-credits',
              id: group.id,
              title: group.title,
              minimumCredits: group.minimum_credits,
              eligibleCourseVersionIds: rows.map((row) => row.course_version_id),
              evidenceRefs: [group.evidence_ref],
            });
          }
        }

        return decodeProgrammeVersion({
          id: version.id,
          programmeId: version.programme_id,
          institutionId: version.institution_id,
          institutionShortName: version.institution_short_name,
          title: version.title,
          cohortStartYear: version.cohort_start_year,
          startSeason: version.start_season,
          durationTerms: version.duration_terms,
          dataRevision: version.data_revision,
          relationAuthority: version.relation_authority,
          requirements,
        });
      },
      catch: (cause) =>
        cause instanceof ProgrammeVersionNotFoundError
          ? cause
          : new RepositoryError({
              operation: 'read programme curriculum',
              message: cause instanceof Error ? cause.message : String(cause),
            }),
    }),
});
