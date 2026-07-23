import { parseGradesNoResponse, type GradesNoParseResult } from './grades-no';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface FetchGradesNoDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

/**
 * Impure edge: performs the live grades.no request and stamps capture
 * metadata from injected fetch/clock/hash implementations, then delegates
 * to the pure {@link parseGradesNoResponse} boundary parser.
 */
export const fetchGradesNoGrades = async (
  deps: FetchGradesNoDeps,
  courseCode: string,
): Promise<GradesNoParseResult> => {
  const requestUrl = `https://api.grades.no/api/v2/courses/${encodeURIComponent(courseCode)}/grades/`;
  const response = await deps.fetch(requestUrl, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`grades.no returned HTTP ${response.status}.`);
  }
  const rawBody = await response.text();
  const contentHash = await deps.sha256Hex(rawBody);

  return parseGradesNoResponse(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    requestUrl,
    courseCode,
    evidenceKind: 'source-fact',
  });
};
