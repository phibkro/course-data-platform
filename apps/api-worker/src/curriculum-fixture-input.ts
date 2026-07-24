import dbh208Fixture from '../../../packages/source-dbh/fixtures/table-208-bit-2024.json';
import dbh208Source from '../../../packages/source-dbh/fixtures/table-208-bit-2024.source.json';
import dbh347Fixture from '../../../packages/source-dbh/fixtures/table-347-bit-2024.json';
import dbh347Source from '../../../packages/source-dbh/fixtures/table-347-bit-2024.source.json';
import ntnuFixture from '../../../packages/source-ntnu/fixtures/bit-2024.json';
import ntnuSource from '../../../packages/source-ntnu/fixtures/bit-2024.source.json';
import type { NtnuCurriculumReconciliationInput } from '@course-data/database';
import { parseTable208, parseTable347 } from '@course-data/source-dbh';
import { parseNtnuCurriculum } from '@course-data/source-ntnu';

export const makeOfficialCurriculumInput = (): NtnuCurriculumReconciliationInput => {
  const programme = parseTable347(dbh347Fixture, {
    retrievedAt: dbh347Source.capturedAt,
    contentHash: dbh347Source.contentHash.rawBody,
  });
  const courses = parseTable208(dbh208Fixture, {
    retrievedAt: dbh208Source.capturedAt,
    contentHash: dbh208Source.contentHash.rawBody,
  });
  const curriculum = parseNtnuCurriculum(ntnuFixture, {
    retrievedAt: ntnuSource.capturedAt,
    contentHash: ntnuSource.contentHash.rawBody,
    requestUrl: ntnuSource.requestUrl,
  });
  const acceptedCurriculum = curriculum.accepted[0];
  if (acceptedCurriculum === undefined)
    throw new Error(
      `Official curriculum fixture was rejected: ${JSON.stringify(curriculum.rejected)}`,
    );
  return {
    curriculum: acceptedCurriculum,
    curriculumRejections: curriculum.rejected,
    dbhProgrammeRecords: programme.accepted,
    dbhCourseRecords: courses.accepted,
    dbhRejections: [...programme.rejected, ...courses.rejected],
  };
};
