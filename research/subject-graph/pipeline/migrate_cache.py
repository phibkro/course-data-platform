"""One-off: move the earlier plain-file cache into the content-addressed evidence store (no refetching).

.cache/pages/<year>/<CODE>.html  -> source ntnu-course-page, key CODE/year
.cache/lists/<year>.json         -> source ntnu-course-list, key year
.cache/plans/<CODE>-<year>.json  -> source ntnu-study-plan,  key CODE-year
fetched_at is the file's modification time, the best record of when it was fetched.
"""
import urllib.parse
from datetime import datetime, timezone

from store import CACHE, Store

LIST_URL = 'https://www.ntnu.edu/web/studies/coursesearch (fetch-courselist-as-json)'
PLAN_URL = 'https://www.ntnu.no/web/studier/studieplan (studyplan)'


def ts(p):
    return datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec='seconds')


s = Store()
done = {k for (k,) in s.db.execute('select distinct key from fetches').fetchall()}
n = 0
for p in sorted((CACHE / 'pages').glob('*/*.html')):
    key = f'{p.stem}/{p.parent.name}'
    if key in done:
        continue
    s.put_evidence(p.read_bytes(), url=f'https://www.ntnu.edu/studies/courses/{urllib.parse.quote(p.stem)}/{p.parent.name}',
                   source='ntnu-course-page', key=key, fetched_at=ts(p))
    n += 1
for p in sorted((CACHE / 'lists').glob('*.json')):
    if p.stem not in done:
        s.put_evidence(p.read_bytes(), url=LIST_URL, params={'semester': p.stem}, source='ntnu-course-list', key=p.stem, fetched_at=ts(p))
for p in sorted((CACHE / 'plans').glob('*.json')):
    if p.stem not in done:
        code, year = p.stem.rsplit('-', 1)
        s.put_evidence(p.read_bytes(), url=PLAN_URL, params={'code': code, 'year': year}, source='ntnu-study-plan', key=p.stem, fetched_at=ts(p))
print(n, 'pages migrated;', s.db.execute('select source, count(*), sum(size) from evidence group by source').fetchall())
