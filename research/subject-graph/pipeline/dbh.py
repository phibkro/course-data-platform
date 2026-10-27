"""Fetch NTNU exam outcomes from DBH (HK-dir's Database for statistikk om høgre utdanning) into the evidence store.

Two tables, one request per table per year for all of NTNU (institution 1150), the same queries as
apps/course-api/src/sources/grades/*-client.ts but without the per-course filter:
  905  Eksamensdata: registered, attended, passed, failed per course version, year and semester
  308  Karakterfordeling: candidates per grade (A-F, G pass, H fail) per course version, year and semester

Refresh policy: reported years change rarely. A year is frozen once its evidence is stored and it is at
least two calendar years back. The current and previous calendar year are refetched when their evidence
is older than --max-age days (default 30). --force refetches everything asked for.

Usage: python3 pipeline/dbh.py [YEAR ...] [--force] [--max-age N]   (default years: 2020 to this year)
"""
import argparse
import json
import subprocess
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from store import Store

ENDPOINT = 'https://dbh-data.dataporten-api.no/Tabeller/hentJSONTabellData'
GROUP_BY = {905: ['Årstall', 'Semester', 'Emnekode'], 308: ['Emnekode', 'Karakter', 'Årstall', 'Semester']}


def query(table, year):
    return {'tabell_id': table, 'api_versjon': 1, 'statuslinje': 'N', 'kodetekst': 'J', 'groupBy': GROUP_BY[table],
            'filter': [{'variabel': 'Institusjonskode', 'selection': {'filter': 'item', 'values': ['1150']}},
                       {'variabel': 'Årstall', 'selection': {'filter': 'item', 'values': [str(year)]}}]}


def post(body):
    r = subprocess.run(['curl', '-sS', '-m', '180', '--retry', '2', '-w', '\n%{http_code}', '-X', 'POST', ENDPOINT,
                        '-H', 'Content-Type: application/json', '-H', 'Accept: application/json',
                        '--data-binary', json.dumps(body)], capture_output=True)
    payload, _, code = r.stdout.rpartition(b'\n')
    return int(code or 0), payload


if __name__ == '__main__':
    this_year = datetime.now(ZoneInfo('Europe/Oslo')).year
    ap = argparse.ArgumentParser()
    ap.add_argument('years', nargs='*', type=int)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--max-age', type=float, default=30)
    a = ap.parse_args()
    years = a.years or list(range(2020, this_year + 1))
    s = Store()
    for table in (905, 308):
        seen = {k: ts for k, ts in s.db.execute(
            'select key, max(fetched_at) from fetches where source = ? group by key', [f'dbh-{table}']).fetchall()}
        for y in years:
            ts = seen.get(str(y))
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(ts)).days if ts else None
            if ts and not a.force and (y <= this_year - 2 or age < a.max_age):
                print(table, y, 'frozen' if y <= this_year - 2 else f'{age} days old, kept')
                continue
            status, body = post(query(table, y))
            if status == 204:  # nothing reported for that year yet; stored as an empty table so --max-age spaces out re-checks
                body = b'[]'
            elif status != 200:
                print(table, y, 'HTTP', status, body[:200])
                continue
            rows = json.loads(body)
            eid = s.put_evidence(body, url=ENDPOINT, params=query(table, y), status=status, source=f'dbh-{table}', key=str(y))
            print(table, y, len(rows), 'rows', eid[:12], 'unchanged' if ts and s.latest_evidence(f'dbh-{table}').get(str(y)) == eid and
                  s.db.execute('select count(*) from fetches where hash = ?', [eid]).fetchall()[0][0] > 1 else 'stored')
