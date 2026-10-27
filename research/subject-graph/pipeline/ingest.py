"""Incremental parse: evidence -> canonical course-year records, with early cutoff.

For every key CODE/year the latest evidence id is looked up. The parse artifact's input hash is
H(evidence id, PARSER_VERSION); a match reuses the stored record without reading the page.
A re-parse whose record hashes the same as before (a page that changed only in tokens, footers
or timestamps) is an early cutoff: downstream stages see no change.

Writes .cache/courses.json (all records) and prints what changed.
"""
import json
import sys
import time

from parse_pages import parse_text
from store import CACHE, Store, h

PARSER_VERSION = 'course-page-v3'

s = Store()
t0 = time.time()
latest = s.latest_evidence('ntnu-course-page')
memo = s.memo_all('parse')
rows, records = [], []
stats = {'reused': 0, 'parsed': 0, 'cutoff': 0, 'changed': 0, 'new': 0, 'unparseable': 0}
changed_keys = []
for key, eid in sorted(latest.items()):
    inp = h(eid, PARSER_VERSION)
    prev = memo.get(key)
    if prev and prev[0] == inp:
        stats['reused'] += 1
        rec = json.loads(prev[2])
    else:
        code, year = key.split('/')
        rec = parse_text(s.get_evidence(eid).decode('utf8', 'ignore'), code, int(year))
        stats['parsed'] += 1
        out = h(rec)
        if prev is None:
            stats['new'] += 1
        elif prev[1] == out:
            stats['cutoff'] += 1
        else:
            stats['changed'] += 1
            changed_keys.append(key)
        rows.append((key, inp, out, PARSER_VERSION, json.dumps(rec, ensure_ascii=False)))
    if rec is None:
        stats['unparseable'] += 1
    else:
        records.append(rec)
s.record('parse', rows)
s.set_deps('parse', [(k, 'evidence', e) for k, e in latest.items()])
(CACHE / 'courses.json').write_text(json.dumps(records, ensure_ascii=False))
print(json.dumps(stats), f'{time.time() - t0:.1f}s', ('changed: ' + ', '.join(changed_keys[:20])) if changed_keys else '', file=sys.stderr)
