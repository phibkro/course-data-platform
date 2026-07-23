import { parseNtnuCourseSearch, type NtnuSearchParseResult } from './search';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const SEARCH_ENDPOINT =
  'https://www.ntnu.no/web/studier/emnesok?p_p_id=courselistportlet_WAR_courselistportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=fetch-courselist-as-json&p_p_cacheability=cacheLevelPage';

export interface FetchNtnuCourseSearchDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

/**
 * Impure edge: performs the live NTNU search request and stamps capture
 * metadata from injected fetch/clock/hash implementations, then delegates
 * to the pure {@link parseNtnuCourseSearch} boundary parser. Never call
 * fetch or a clock from mapping code directly (see AGENTS.md).
 */
export interface NtnuCourseSearchQuery {
  readonly queryString: string;
  readonly academicYear: number;
  readonly season: 'spring' | 'autumn';
  readonly page: number;
  readonly sort: 'relevance' | 'title-asc' | 'title-desc' | 'code-asc' | 'code-desc';
  readonly campuses: ReadonlyArray<'trondheim' | 'gjovik' | 'alesund'>;
  readonly levels: ReadonlyArray<'bachelor' | 'master' | 'phd' | 'other'>;
  readonly continuingEducation: boolean;
  readonly open: boolean;
  readonly english: boolean;
}

const providerSort = (sort: NtnuCourseSearchQuery['sort']): string => {
  switch (sort) {
    case 'relevance':
      return 'relevancy';
    case 'title-asc':
      return '+title';
    case 'title-desc':
      return '-title';
    case 'code-asc':
      return '+ntnucoursecode';
    case 'code-desc':
      return '-ntnucoursecode';
  }
};

export const fetchNtnuCourseSearch = async (
  deps: FetchNtnuCourseSearchDeps,
  query: NtnuCourseSearchQuery,
): Promise<NtnuSearchParseResult> => {
  const body = new URLSearchParams({
    searchQueryString: query.queryString,
    semester: String(query.academicYear),
    season: query.season,
    pageNo: String(query.page),
    sortOrder: providerSort(query.sort),
    courseAutumn: String(query.season === 'autumn'),
    courseSpring: String(query.season === 'spring'),
    courseSummer: 'false',
    trondheim: String(query.campuses.includes('trondheim')),
    gjovik: String(query.campuses.includes('gjovik')),
    alesund: String(query.campuses.includes('alesund')),
    faculty: '-1',
    institute: '-1',
    bachelor: String(query.levels.includes('bachelor')),
    master: String(query.levels.includes('master')),
    phd: String(query.levels.includes('phd')),
    other: String(query.levels.includes('other')),
    continuingEducation: String(query.continuingEducation),
    open: String(query.open),
    english: String(query.english),
    multimedia: 'false',
  });
  const response = await deps.fetch(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`NTNU course search returned HTTP ${response.status}.`);
  }
  const rawBody = await response.text();
  const contentHash = await deps.sha256Hex(rawBody);

  return parseNtnuCourseSearch(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    requestUrl: SEARCH_ENDPOINT,
    queryString: query.queryString,
    academicYear: query.academicYear,
    season: query.season,
    evidenceKind: 'source-fact',
  });
};
