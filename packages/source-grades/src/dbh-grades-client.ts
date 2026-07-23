import { parseDbhGrades, type DbhGradesParseResult } from './dbh-grades';
import type { FetchLike } from './grades-no-client';

const DBH_ENDPOINT = 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData';

export interface FetchDbhGradesDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

/**
 * Impure edge: performs the live DBH table-308 request and stamps capture
 * metadata from injected fetch/clock/hash implementations, then delegates
 * to the pure {@link parseDbhGrades} boundary parser.
 */
export const fetchDbhGrades = async (
  deps: FetchDbhGradesDeps,
  courseCode: string,
  fromYear: number,
  toYear: number,
): Promise<DbhGradesParseResult> => {
  const body = JSON.stringify({
    tabell_id: 308,
    api_versjon: 1,
    statuslinje: 'N',
    kodetekst: 'J',
    groupBy: ['Karakter'],
    filter: [
      { variabel: 'Institusjonskode', selection: { filter: 'item', values: ['1150'] } },
      { variabel: 'Emnekode', selection: { filter: 'like', values: [`${courseCode}%`] } },
      { variabel: 'Årstall', selection: { filter: 'range', values: [String(fromYear), String(toYear)] } },
    ],
  });
  const response = await deps.fetch(DBH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  });
  if (!response.ok) {
    throw new Error(`DBH table 308 returned HTTP ${response.status}.`);
  }
  const rawBody = await response.text();
  const contentHash = await deps.sha256Hex(rawBody);

  return parseDbhGrades(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    courseCode,
    fromYear,
    toYear,
    evidenceKind: 'source-fact',
  });
};
