// Real local HTTP/API transport with explicitly synthetic source evidence.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixtureCourseDecisionService } from '../../course-api/src/course-decision/fixture';
import {
  mapNtnuDetailToCourseDecisionSignals,
  parseNtnuCourseDetail,
} from '../../course-api/src/sources/ntnu';
import { Effect } from 'effect';

import { createCourseApi } from '../../course-api/src/app';

const source = readFileSync(
  new URL(
    '../../course-api/src/sources/ntnu/fixtures/invalid-assessment-weights.html',
    import.meta.url,
  ),
  'utf8',
);
const parsed = parseNtnuCourseDetail(source, {
  retrievedAt: '2026-09-19T00:00:00.000Z',
  contentHash: createHash('sha256').update(source).digest('hex'),
  requestUrl: 'https://www.ntnu.no/studier/emner/TDT4136/2026',
  courseCode: 'TDT4136',
  evidenceKind: 'fixture',
});
if (parsed.accepted === null) throw new Error('Synthetic assessment fixture failed to parse');
const signals = mapNtnuDetailToCourseDecisionSignals(
  'TDT4136',
  2026,
  'autumn',
  parsed.accepted,
  null,
);

const service = {
  ...fixtureCourseDecisionService,
  getInsight: (request: Parameters<typeof fixtureCourseDecisionService.getInsight>[0]) =>
    fixtureCourseDecisionService.getInsight(request).pipe(
      Effect.map((response) => ({
        ...response,
        item: {
          ...response.item,
          assessment: signals.assessment,
          evidence: [...response.item.evidence, ...signals.evidence],
        },
      })),
    ),
};

createCourseApi(service).listen({ hostname: '127.0.0.1', port: 4176 });
