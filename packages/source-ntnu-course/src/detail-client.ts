import { parseNtnuCourseDetail, type NtnuDetailParseResult } from './detail';
import type { FetchLike } from './search-client';

export interface FetchNtnuCourseDetailDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

/**
 * Impure edge: performs the live NTNU course-detail page request and stamps
 * capture metadata from injected fetch/clock/hash implementations, then
 * delegates to the pure {@link parseNtnuCourseDetail} boundary parser.
 */
export const fetchNtnuCourseDetail = async (
  deps: FetchNtnuCourseDetailDeps,
  courseCode: string,
  term: string,
): Promise<NtnuDetailParseResult> => {
  const requestUrl = `https://www.ntnu.no/studier/emner/${encodeURIComponent(courseCode)}/${encodeURIComponent(term)}`;
  const response = await deps.fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`NTNU course detail returned HTTP ${response.status}.`);
  }
  const rawBody = await response.text();
  const contentHash = await deps.sha256Hex(rawBody);

  return parseNtnuCourseDetail(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    requestUrl,
    courseCode,
    evidenceKind: 'source-fact',
  });
};
