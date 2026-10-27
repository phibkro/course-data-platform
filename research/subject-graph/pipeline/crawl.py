"""Crawl NTNU course lists and course pages for several study years into .cache/.

  .cache/lists/<year>.json         every course offered that study year (NTNU course search JSON)
  .cache/pages/<year>/<CODE>.html  the English course page for that year

Polite by default: 6 concurrent requests, cached pages are never fetched again.
Usage: python3 pipeline/crawl.py 2023 2024 2025 2026
"""
import json
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
LIST_URL = ('https://www.ntnu.edu/web/studies/coursesearch?p_p_id=courselistportlet_WAR_courselistportlet'
            '&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=fetch-courselist-as-json'
            '&p_p_cacheability=cacheLevelPage')


def curl(args):
    return subprocess.run(['curl', '-sS', '-m', '60', '--retry', '2', *args], capture_output=True).stdout


def course_list(year):
    """The list endpoint pages over an unstable ordering, so one pass misses courses.
    Repeat full passes until a pass adds nothing new (at most 5)."""
    out = CACHE / 'lists' / f'{year}.json'
    if out.exists():
        return json.loads(out.read_text())
    courses = {}
    for _ in range(5):
        before, page = len(courses), 1
        while True:
            d = json.loads(curl(['-X', 'POST', LIST_URL, '--data-urlencode', f'semester={year}',
                                 '--data-urlencode', f'pageNo={page}']))
            for c in d['courses']:
                courses.setdefault(c['courseCode'], c)
            if not d['courses'] or not d.get('hasMoreResults'):
                break
            page += 1
        if len(courses) == before:
            break
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(list(courses.values()), ensure_ascii=False))
    return list(courses.values())


def fetch(args):
    year, code = args
    out = CACHE / 'pages' / str(year) / f'{code}.html'
    if out.exists() and out.stat().st_size > 5000:
        return 'cached'
    url = f'https://www.ntnu.edu/studies/courses/{urllib.parse.quote(code)}/{year}'
    body = curl(['-L', url])
    if len(body) > 5000:
        out.write_bytes(body)
        return 'ok'
    return 'failed'


if __name__ == '__main__':
    years = [int(y) for y in sys.argv[1:]] or [2026]
    jobs = []
    for y in years:
        lst = course_list(y)
        print(y, len(lst), 'courses listed', flush=True)
        (CACHE / 'pages' / str(y)).mkdir(parents=True, exist_ok=True)
        jobs += [(y, c['courseCode']) for c in lst]
    t0, done = time.time(), {'ok': 0, 'cached': 0, 'failed': 0}
    with ThreadPoolExecutor(6) as ex:
        for k, r in enumerate(ex.map(fetch, jobs), 1):
            done[r] += 1
            if k % 500 == 0:
                print(f'{k}/{len(jobs)} {done} {time.time() - t0:.0f}s', flush=True)
    print('finished', done, f'{time.time() - t0:.0f}s', flush=True)
