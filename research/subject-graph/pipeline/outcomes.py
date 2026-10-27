"""DBH evidence -> per-course exam outcomes (.cache/outcomes.json), for the most recent three reported years.

Definitions (checked 27 Oct 2026: grades.no's counts equal the table 308 sums for all 564 courses both cover):
  graded    candidates with a grade in table 308 (A-F, G pass, H fail)
  passed    graded minus F and H
  attended  'Møtt til eksamen' in table 905 (also counts candidates who attended but got no grade)
Course versions (TDT4136-1, TDT4136-2) are summed under the base code.

DBH publishes 0 both for a true zero and for a count of 1-2 that is suppressed for privacy. Each zero cell
can therefore hide up to 2 candidates, so the pass rate is a range: `pass_range` = [lowest, highest]
consistent with the suppressed cells. `pass` keeps the point counts [passed, graded].
"""
import json
import sys
from collections import Counter, defaultdict

from store import CACHE, Store

GRADES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
YEARS_IN_WINDOW = 3

s = Store()
r308 = {int(y): json.loads(s.get_evidence(e)) for y, e in s.latest_evidence('dbh-308').items()}
r905 = {int(y): json.loads(s.get_evidence(e)) for y, e in s.latest_evidence('dbh-905').items()}
reported = sorted(y for y, rows in r308.items() if rows)
window = reported[-YEARS_IN_WINDOW:]

grades = defaultdict(Counter)
zero_pass, zero_fail = Counter(), Counter()
terms = defaultdict(lambda: defaultdict(lambda: [0, 0, 0, 0]))  # (year, sem) -> registered, attended, graded, failed
for y in window:
    for r in r308[y]:
        code, n, g = r['Emnekode'].rsplit('-', 1)[0], int(r['Antall kandidater totalt']), r['Karakter']
        grades[code][g] += n
        t = terms[code][(y, int(r['Semester']))]
        t[2] += n
        t[3] += n if g in 'FH' else 0
        if n == 0:
            (zero_fail if g in 'FH' else zero_pass)[code] += 1
    for r in r905.get(y, []):
        code = r['Emnekode'].rsplit('-', 1)[0]
        t = terms[code][(y, int(r['Semester']))]
        t[0] += int(r['Oppmeldt totalt'])
        t[1] += int(r['Møtt til eksamen'])

out = {}
for code, gc in grades.items():
    graded = sum(gc.values())
    if not graded:
        continue
    failed = gc['F'] + gc['H']
    passed = graded - failed
    lo = passed / (graded + 2 * zero_fail[code])
    hi = (passed + 2 * zero_pass[code]) / (graded + 2 * zero_pass[code])
    out[code] = {
        'graded': graded, 'passed': passed, 'pass_range': [round(lo, 3), round(hi, 3)],
        'grades': [gc[g] for g in GRADES], 'suppressed_cells': zero_pass[code] + zero_fail[code],
        'attended': sum(t[1] for t in terms[code].values()), 'registered': sum(t[0] for t in terms[code].values()),
        'terms': [[y, 'spring' if sem == 1 else 'autumn', *v] for (y, sem), v in sorted(terms[code].items())],
    }
meta = {'source': 'DBH tables 308 and 905, NTNU (1150)', 'window': [window[0], window[-1]], 'reported_years': reported,
        'evidence': {f'dbh-{t}': {y: e[:12] for y, e in sorted(s.latest_evidence(f'dbh-{t}').items())} for t in (308, 905)}}
(CACHE / 'outcomes.json').write_text(json.dumps({'meta': meta, 'courses': out}, ensure_ascii=False, sort_keys=True))
wide = sum(1 for c in out.values() if c['pass_range'][1] - c['pass_range'][0] > 0.05)
print(f"{len(out)} courses with graded candidates in {window[0]}-{window[-1]}; {wide} with a pass-rate range wider than 5 points", file=sys.stderr)
