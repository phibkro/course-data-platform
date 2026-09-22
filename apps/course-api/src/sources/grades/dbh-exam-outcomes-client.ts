import { parseDbhExamOutcomes, type DbhExamOutcomesParseResult } from './dbh-exam-outcomes';
import type { FetchLike } from './fetch';

const DBH_ENDPOINT = 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData';

export interface FetchDbhExamOutcomesDeps {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly sha256Hex: (input: string) => Promise<string>;
}

export const fetchDbhExamOutcomes = async (
  deps: FetchDbhExamOutcomesDeps,
  courseCode: string,
  fromYear: number,
  toYear: number,
): Promise<DbhExamOutcomesParseResult> => {
  const normalizedCode = courseCode.trim().toUpperCase();
  const body = JSON.stringify({
    tabell_id: 905,
    api_versjon: 1,
    statuslinje: 'N',
    kodetekst: 'J',
    groupBy: ['Årstall', 'Semester', 'Emnekode'],
    filter: [
      { variabel: 'Institusjonskode', selection: { filter: 'item', values: ['1150'] } },
      {
        variabel: 'Emnekode',
        selection: { filter: 'like', values: [`${normalizedCode}-%`] },
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
    throw new Error(`DBH table 905 returned HTTP ${response.status}.`);
  }
  const rawBody = await response.text();
  const contentHash = await deps.sha256Hex(rawBody);

  return parseDbhExamOutcomes(rawBody, {
    retrievedAt: deps.now().toISOString(),
    contentHash,
    requestUrl: DBH_ENDPOINT,
    courseCode: normalizedCode,
    fromYear,
    toYear,
    evidenceKind: 'source-fact',
  });
};
