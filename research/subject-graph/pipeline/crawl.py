"""Incremental crawl of NTNU course lists and course pages, written through the evidence store.

Calendar-aware: course data changes in study-year steps, so requests follow the calendar.
  frozen years   study years before the current one are never refetched once stored (--force overrides).
  open years     the current study year and any later one asked for. Their course list is refetched when
                 the stored one is older than --list-max-age days (default 7).
  list diff      each list entry (code, name, courseVersion, exam dates, location) is hashed. A course
                 page is fetched only when its entry is new or changed, when no page is stored, or when the
                 stored page is older than --page-max-age days (default 60, a safety net for edits that
                 do not bump courseVersion).
Every response goes into .cache/store.duckdb + .cache/evidence/ by content hash; an unchanged page adds a
fetch row but no new blob, and ingest.py then reuses its parse.

Usage: python3 pipeline/crawl.py 2023 2024 2025 2026 [--dry-run] [--force] [--list-max-age N] [--page-max-age N]
"""
import argparse
import json
import subprocess
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from store import Store, h

LIST_URL = ('https://www.ntnu.edu/web/studies/coursesearch?p_p_id=courselistportlet_WAR_courselistportlet'
            '&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=fetch-courselist-as-json'
            '&p_p_cacheability=cacheLevelPage')
LIST_LABEL = 'https://www.ntnu.edu/web/studies/coursesearch (fetch-courselist-as-json)'


def curl(args):
    """Returns (status, body). Status 0 means no response."""
    r = subprocess.run(['curl', '-sS', '-m', '60', '--retry', '2', '-w', '\n%{http_code}', *args], capture_output=True)
    body, _, code = r.stdout.rpartition(b'\n')
    return int(code or 0), body


def current_study_year(now=None):
    """NTNU study years start in August (Europe/Oslo)."""
    now = now or datetime.now(ZoneInfo('Europe/Oslo'))
    return now.year if now.month >= 8 else now.year - 1


def fetch_list(year):
    """The list endpoint pages over an unstable ordering, so one pass misses courses.
    Repeat full passes until a pass adds nothing new (at most 5). Returns entries sorted by code."""
    courses, requests = {}, 0
    for _ in range(5):
        before, page = len(courses), 1
        while True:
            status, body = curl(['-X', 'POST', LIST_URL, '--data-urlencode', f'semester={year}',
                                 '--data-urlencode', f'pageNo={page}'])
            requests += 1
            if status != 200:
                raise RuntimeError(f'course list {year} page {page}: HTTP {status}')
            d = json.loads(body)
            for c in d['courses']:
                courses.setdefault(c['courseCode'], c)
            if not d['courses'] or not d.get('hasMoreResults'):
                break
            page += 1
        if len(courses) == before:
            break
    return [courses[k] for k in sorted(courses)], requests


def age_days(ts):
    return (datetime.now(timezone.utc) - datetime.fromisoformat(ts)).total_seconds() / 86400


def fetch_page(job):
    year, code = job
    url = f'https://www.ntnu.edu/studies/courses/{urllib.parse.quote(code)}/{year}'
    status, body = curl(['-L', url])
    return year, code, url, status, body


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('years', nargs='*', type=int)
    ap.add_argument('--dry-run', action='store_true', help='fetch lists, report what would be fetched, fetch no pages')
    ap.add_argument('--force', action='store_true', help='treat frozen years as open')
    ap.add_argument('--list-max-age', type=float, default=7)
    ap.add_argument('--page-max-age', type=float, default=60)
    a = ap.parse_args()
    years = a.years or [current_study_year()]
    s = Store()
    open_from = current_study_year()
    list_seen = {k: (e, ts) for k, e, ts in s.db.execute("""
        select key, hash, fetched_at from (select key, hash, fetched_at,
          row_number() over (partition by key order by fetched_at desc) r from fetches where source = 'ntnu-course-list') where r = 1""").fetchall()}
    page_seen = {k: ts for k, ts in s.db.execute("""
        select key, max(fetched_at) from fetches where source = 'ntnu-course-page' and hash in (select hash from evidence where status = 200 and size > 5000)
        group by key""").fetchall()}

    jobs, report = [], {}
    for y in years:
        frozen = y < open_from and not a.force
        prev = list_seen.get(str(y))
        prev_entries = {c['courseCode']: h(c) for c in json.loads(s.get_evidence(prev[0]))} if prev else {}
        if prev and (frozen or age_days(prev[1]) < a.list_max_age):
            entries, why = prev_entries, 'frozen' if frozen else f'list {age_days(prev[1]):.1f} days old'
            changed, removed, requests = set(), set(), 0
        else:
            lst, requests = fetch_list(y)
            body = json.dumps(lst, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
            if not a.dry_run:
                s.put_evidence(body, url=LIST_LABEL, params={'semester': str(y)}, source='ntnu-course-list', key=str(y))
            entries = {c['courseCode']: h(c) for c in lst}
            changed = {c for c, eh in entries.items() if prev_entries.get(c) != eh}
            removed = set(prev_entries) - set(entries)
            why = 'refetched list'
        stale = set() if frozen else {c for c in entries if age_days(page_seen.get(f'{c}/{y}', '1970-01-01T00:00:00+00:00')) >= a.page_max_age}
        missing = {c for c in entries if f'{c}/{y}' not in page_seen}
        todo = [] if frozen else sorted(changed | missing | stale)  # a frozen year reports gaps but does not retry them
        jobs += [(y, c) for c in todo]
        report[y] = {'mode': why, 'list_requests': requests, 'listed': len(entries), 'new_or_changed_entries': len(changed),
                     'removed_entries': len(removed), 'pages_missing': len(missing), 'pages_stale': len(stale - changed - missing),
                     'pages_to_fetch': len(todo), 'gaps_left_frozen': len(missing) if frozen else 0, 'sample': todo[:8]}
        print(y, json.dumps(report[y], ensure_ascii=False), flush=True)

    if a.dry_run or not jobs:
        print('no pages fetched' + (' (dry run)' if a.dry_run else ''))
        raise SystemExit
    t0, done = time.time(), {'stored': 0, 'unchanged': 0, 'failed': 0}
    with ThreadPoolExecutor(6) as ex:  # 6 concurrent requests; store writes stay on this thread
        for k, (y, code, url, status, body) in enumerate(ex.map(fetch_page, jobs), 1):
            if status != 200 or len(body) < 5000:
                done['failed'] += 1
                continue
            known = s.db.execute('select 1 from evidence where hash = ?', [h(body)]).fetchall()
            s.put_evidence(body, url=url, status=status, source='ntnu-course-page', key=f'{code}/{y}')
            done['unchanged' if known else 'stored'] += 1
            if k % 500 == 0:
                print(f'{k}/{len(jobs)} {done} {time.time() - t0:.0f}s', flush=True)
    print('finished', done, f'{time.time() - t0:.0f}s')
