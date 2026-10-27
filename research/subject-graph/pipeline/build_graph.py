"""Build the subject/tag graph from parsed courses and study plans.

Model (see ../README.md), in graph-theory / graphology / sigma.js terms:
  node     = subject (a vertex) | cluster (a named group of subjects: a programme, a semester, a code prefix ...)
  clustering = a family of clusters, e.g. "Teaching term"; a subject may sit in several clusters of one
             clustering, so a clustering is a cover rather than a partition
  edge  = {s, t, kind, directed, w, q, ev}
          kind     relation name
          directed true for asymmetric relations
          w        weight or null
          q        qualifiers (role, period, grade, ...)
          ev       evidence: [source, method, confidence]

Output: .cache/graph_base.json (enriched later by enrich.py).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
CODE = re.compile(r'\b([A-ZÆØÅ]{2,}[A-Z]*\d{3,5}[A-Z]?)\b')
PAGE = 'ntnu-course-page-2026'

records = json.loads((CACHE / 'courses.json').read_text())
by_code = {}
for r in records:
    by_code.setdefault(r['code'], []).append(r)
# One subject per code. Stable facts come from the newest study year; year-bound facts become year tags.
courses = [max(rs, key=lambda r: r['year']) | {'years': sorted({r['year'] for r in rs if not r.get('not_offered')}),
                                               'terms': sorted({t for r in rs for t in re.findall(r'(?:Autumn|Spring|Summer) \d{4}', r.get('start') or '')})}
           for rs in by_code.values()]
known = set(by_code)
CODE_PARTS = re.compile(r'^([A-ZÆØÅ]+)(\d)(\d*)([A-Z]?)$')
nodes, edges, cluster_ids = {}, [], set()


def cluster(ns, value, label=None, parent=None):
    tid = f'{ns}:{value}'
    if tid not in cluster_ids:
        cluster_ids.add(tid)
        nodes[tid] = {'id': tid, 'kind': 'cluster', 'ns': ns, 'label': label or value}
        if parent:
            edges.append({'s': tid, 't': parent, 'kind': 'part_of', 'directed': True, 'w': None, 'q': {}, 'ev': ['structure', 'derived', 1]})
    return tid


def edge(s, t, kind, directed, w=None, q=None, ev=(PAGE, 'parsed', 1)):
    edges.append({'s': s, 't': t, 'kind': kind, 'directed': directed, 'w': w, 'q': q or {}, 'ev': list(ev)})


def num(x):
    try:
        return float(str(x).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def exam_kind(c):
    """Rank the hardest assessment part: none < home < oral < part-school < school."""
    blk = (c.get('exam_block') or '').lower()
    parts = {}
    for label, w in re.findall(r'\| ([^|]+?) \| weighting \| (\d+)/100', blk):
        parts.setdefault(label.strip(), int(w))
    school = sum(w for l, w in parts.items() if re.search(r'school exam|written exam|digital exam|written examination', l))
    if not parts and re.search(r'school exam|written exam', blk):
        school = 100
    if school >= 100: return 'school'
    if school: return 'part-school'
    if any('oral' in l for l in parts) or 'oral' in (c.get('assessment') or '').lower(): return 'oral'
    if any('home' in l for l in parts): return 'home'
    return 'none'


for ns, label in [('level', 'Level'), ('campus', 'Campus'), ('lang', 'Language'), ('exam', 'Hardest assessment'),
                  ('term', 'Teaching term'), ('offered', 'Offered in study year'), ('prefix', 'Code prefix'),
                  ('code-level', 'Code level (first digit)'), ('programme', 'Programme'), ('flag', 'Flag'), ('access', 'Admission')]:
    cluster('clustering', ns, label)

for c in courses:
    code = c['code']
    PAGE = f"ntnu-course-page-{c['year']}"
    nodes[code] = {'id': code, 'kind': 'subject', 'label': c['name'], 'cr': num(c['credits']), 'years': c['years']}
    for y in c['years']:
        edge(code, cluster('offered', str(y), f'{y}/{(y + 1) % 100:02d}', 'clustering:offered'), 'in_cluster', True, ev=(f'ntnu-course-list-{y}', 'listed', 1))
    m = CODE_PARTS.match(code)
    if m:
        edge(code, cluster('prefix', m.group(1), parent='clustering:prefix'), 'in_cluster', True, ev=('course-code', 'code-pattern-v1', 1))
        edge(code, cluster('code-level', m.group(2), f'{m.group(2)}xxx', 'clustering:code-level'), 'in_cluster', True, ev=('course-code', 'code-pattern-v1', 0.7))
    if c.get('level'): edge(code, cluster('level', c['level'], parent='clustering:level'), 'in_cluster', True)
    for loc in re.split(r'\s+and\s+|,\s*', c.get('location') or ''):
        if loc: edge(code, cluster('campus', loc.strip(), parent='clustering:campus'), 'in_cluster', True)
    for lang in re.split(r',\s*|\s+and\s+', c.get('language') or ''):
        if lang: edge(code, cluster('lang', lang.strip(), parent='clustering:lang'), 'in_cluster', True)
    edge(code, cluster('exam', exam_kind(c), parent='clustering:exam'), 'in_cluster', True, ev=(PAGE, 'exam-block-rules-v1', 0.8))
    for term in c['terms']:
        season, y = term.split()
        edge(code, cluster('term', f'{season.lower()}-{y}', term, 'clustering:term'), 'in_cluster', True)
    if c.get('restricted'):
        edge(code, cluster('access', 'restricted', 'Programme admission required', 'clustering:access'), 'in_cluster', True)
        for p in c.get('admission_programmes') or []:
            edge(code, cluster('programme', p, parent='clustering:programme'), 'admits', True, ev=(PAGE, 'admission-section', 1))
    else:
        edge(code, cluster('access', 'open', 'Open to all programmes', 'clustering:access'), 'in_cluster', True)
    txt = ' '.join(filter(None, [c.get('assessment'), c.get('methods'), c.get('compulsory'), c.get('further')]))
    for flag, pat in [('group-work', r'\bgroups?\b|\bteams?\b'),
                      ('attendance', r'attendance|compulsory (participation|presence)|mandatory (participation|attendance)|\d+\s?% (participation|attendance)'),
                      ('online', r'online|self-study|recorded|webinar|digital teaching')]:
        if re.search(pat, txt, re.I):
            edge(code, cluster('flag', flag, parent='clustering:flag'), 'in_cluster', True, ev=(PAGE, f'keyword-{flag}-v1', 0.6))
    seen = set()
    for r in c.get('reductions') or []:
        other = r['code']
        if other == code or other in seen: continue
        seen.add(other)
        if other not in nodes and other not in known:
            nodes[other] = {'id': other, 'kind': 'subject', 'label': other, 'retired': True}
        edge(code, other, 'overlaps', False, r['credits'], ev=(PAGE, 'credit-reduction-table', 1))
    for kind, field in [('requires', 'required'), ('recommends', 'recommended')]:
        for other in dict.fromkeys(CODE.findall(c.get(field) or '')):
            if other != code and other in known:
                edge(code, other, kind, True, q={'phrase': None}, ev=(PAGE, f'{field}-code-mention', 0.9))

# Study plans: programme -> (direction) -> course group, each a tag; courses are members of groups.
CHOICE = {'O': 'compulsory', 'V': 'elective', 'VA': 'elective', 'VB': 'elective', 'M': 'elective'}


def walk_plan(node, parent_tag, plan, period):
    for wp in node.get('studyWaypoints') or []:
        for d in wp.get('studyDirections') or []:
            dt = cluster('direction', f"{plan}/{d['code']}", d['name'], parent_tag)
            walk_plan(d, dt, plan, period)
    for g in node.get('courseGroups') or []:
        gt = cluster('group', f"{plan}/{g['code']}", g['name'], parent_tag)
        for course in g.get('courses') or []:
            cc = course['code']
            if cc not in nodes:
                nodes[cc] = {'id': cc, 'kind': 'subject', 'label': course.get('name') or cc, 'cr': num(course.get('credit'))}
            choice = (course.get('studyChoice') or {}).get('code')
            edge(cc, gt, 'in_cluster', True, q={'role': CHOICE.get(choice, choice or 'unknown'),
                 'choice': (course.get('studyChoice') or {}).get('name'), 'period': int(period)},
                 ev=('ntnu-study-plan', 'studyplan-json', 1))


import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from store import Store
_store = Store()
for _key, _eid in sorted(_store.latest_evidence('ntnu-study-plan').items()):  # same evidence run.py hashes as input
    try:
        sp = json.loads(_store.get_evidence(_eid))['studyplan']
    except (TypeError, KeyError, json.JSONDecodeError):
        continue
    if not sp:
        continue
    plan = f"{sp['code']}-{sp['year']}"
    pt = cluster('programme', plan, f"{sp['name']} ({sp['year']})", 'clustering:programme')
    for period in sp['studyPeriods']:
        walk_plan(period.get('direction') or {}, pt, plan, period['periodNumber'])

merged, out = {}, []
for e in edges:
    if e['kind'] == 'overlaps':
        key = tuple(sorted((e['s'], e['t'])))
        if key in merged:
            merged[key]['q']['listed_on'] = 'both pages'
            continue
        e['q'] = {'listed_on': e['s']}
        merged[key] = e
    out.append(e)
edges[:] = out
(CACHE / 'graph_base.json').write_text(json.dumps({'nodes': list(nodes.values()), 'edges': edges}, ensure_ascii=False))
from collections import Counter
print(len(nodes), 'nodes', Counter(n['kind'] for n in nodes.values()))
print(len(edges), 'edges', Counter(e['kind'] for e in edges))
