import {
  parseNtnuCourseSchedule,
  type NtnuScheduleParseResult,
  type NtnuScheduleHttpValidator,
} from './schedule';
import type { FetchLike } from './search-client';

const SCHEDULE_RESOURCE_URL =
  'https://www.ntnu.no/web/studier/emner?p_p_id=coursedetailsportlet_WAR_courselistportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&p_p_resource_id=schedules';

export interface FetchNtnuCourseScheduleDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

export interface NtnuCourseScheduleQuery {
  readonly courseCode: string;
  readonly courseVersion: string;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
}

/**
 * Impure edge: performs the live NTNU schedule request and stamps capture
 * metadata from injected fetch, clock, and hash implementations before
 * delegating to the pure {@link parseNtnuCourseSchedule} boundary parser.
 */
export const fetchNtnuCourseSchedule = async (
  deps: FetchNtnuCourseScheduleDeps,
  query: NtnuCourseScheduleQuery,
): Promise<NtnuScheduleParseResult> => {
  const requestUrl = `${SCHEDULE_RESOURCE_URL}&_coursedetailsportlet_WAR_courselistportlet_courseCode=${encodeURIComponent(query.courseCode)}&year=${encodeURIComponent(String(query.academicYear))}&version=${encodeURIComponent(query.courseVersion)}`;
  const response = await deps.fetch(requestUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`NTNU course schedule returned HTTP ${response.status}.`);
  }
  const etag = response.headers.get('etag')?.trim();
  const httpValidator: NtnuScheduleHttpValidator =
    etag === undefined || etag === ''
      ? { state: 'unknown', reason: 'etag-not-published' }
      : { state: 'known', kind: 'http-etag', value: etag };
  const rawBody = await response.text();
  const contentHash = await deps.sha256Hex(rawBody);

  return parseNtnuCourseSchedule(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    httpValidator,
    requestUrl,
    courseCode: query.courseCode,
    courseVersion: query.courseVersion,
    academicYear: query.academicYear,
    season: query.season,
    timezone: 'Europe/Oslo',
    evidenceKind: 'source-fact',
  });
};
