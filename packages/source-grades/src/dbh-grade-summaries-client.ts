import { parseDbhGradeSummaries, type DbhGradeSummariesParseResult } from './dbh-grade-summaries';
import type { FetchLike } from './grades-no-client';

const DBH_ENDPOINT = 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData';

export interface FetchDbhGradeSummariesDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

export const fetchDbhGradeSummaries = async (
  deps: FetchDbhGradeSummariesDeps,
  courseCodes: ReadonlyArray<string>,
  fromYear: number,
  toYear: number,
): Promise<DbhGradeSummariesParseResult> => {
  const normalizedCodes = [...new Set(courseCodes.map((code) => code.trim().toUpperCase()))];
  const body = JSON.stringify({
    tabell_id: 308,
    api_versjon: 1,
    statuslinje: 'N',
    kodetekst: 'J',
    groupBy: ['Emnekode', 'Karakter', 'Årstall', 'Semester'],
    filter: [
      { variabel: 'Institusjonskode', selection: { filter: 'item', values: ['1150'] } },
      {
        variabel: 'Emnekode',
        selection: { filter: 'like', values: normalizedCodes.map((code) => `${code}-%`) },
      },
      {
        variabel: 'Årstall',
        selection: { filter: 'between', values: [String(fromYear), String(toYear)] },
      },
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

  return parseDbhGradeSummaries(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    courseCodes: normalizedCodes,
    fromYear,
    toYear,
    evidenceKind: 'source-fact',
  });
};
