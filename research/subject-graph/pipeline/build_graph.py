"""Build the subject/tag graph from parsed courses and study plans.

Model (see ../README.md):
  node  = subject | tag            tags carry metadata (programme, level, campus, exam type, ...)
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

courses = json.loads((CACHE / 'courses.json').read_text())
known = {c['code'] for c in courses}
nodes, edges, tag_ids = {}, [], set()


def tag(ns, value, label=None, parent=None):
    tid = f'{ns}:{value}'
    if tid not in tag_ids:
        tag_ids.add(tid)
        nodes[tid] = {'id': tid, 'kind': 'tag', 'ns': ns, 'label': label or value}
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
                  ('term', 'Teaching term'), ('programme', 'Programme'), ('flag', 'Flag'), ('access', 'Admission')]:
    tag('kind', ns, label)

for c in courses:
    code = c['code']
    nodes[code] = {'id': code, 'kind': 'subject', 'label': c['name'], 'cr': num(c['credits'])}
    if c.get('level'): edge(code, tag('level', c['level'], parent='kind:level'), 'tagged', True)
    for loc in re.split(r'\s+and\s+|,\s*', c.get('location') or ''):
        if loc: edge(code, tag('campus', loc.strip(), parent='kind:campus'), 'tagged', True)
    for lang in re.split(r',\s*|\s+and\s+', c.get('language') or ''):
        if lang: edge(code, tag('lang', lang.strip(), parent='kind:lang'), 'tagged', True)
    edge(code, tag('exam', exam_kind(c), parent='kind:exam'), 'tagged', True, ev=(PAGE, 'exam-block-rules-v1', 0.8))
    for term in re.findall(r'(Autumn|Spring|Summer) (\d{4})', c.get('start') or ''):
        edge(code, tag('term', f'{term[0].lower()}-{term[1]}', f'{term[0]} {term[1]}', 'kind:term'), 'tagged', True)
    if c.get('restricted'):
        edge(code, tag('access', 'restricted', 'Programme admission required', 'kind:access'), 'tagged', True)
        for p in c.get('admission_programmes') or []:
            edge(code, tag('programme', p, parent='kind:programme'), 'admits', True, ev=(PAGE, 'admission-section', 1))
    else:
        edge(code, tag('access', 'open', 'Open to all programmes', 'kind:access'), 'tagged', True)
    txt = ' '.join(filter(None, [c.get('assessment'), c.get('methods'), c.get('compulsory'), c.get('further')]))
    for flag, pat in [('group-work', r'\bgroups?\b|\bteams?\b'),
                      ('attendance', r'attendance|compulsory (participation|presence)|mandatory (participation|attendance)|\d+\s?% (participation|attendance)'),
                      ('online', r'online|self-study|recorded|webinar|digital teaching')]:
        if re.search(pat, txt, re.I):
            edge(code, tag('flag', flag, parent='kind:flag'), 'tagged', True, ev=(PAGE, f'keyword-{flag}-v1', 0.6))
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
            dt = tag('direction', f"{plan}/{d['code']}", d['name'], parent_tag)
            walk_plan(d, dt, plan, period)
    for g in node.get('courseGroups') or []:
        gt = tag('group', f"{plan}/{g['code']}", g['name'], parent_tag)
        for course in g.get('courses') or []:
            cc = course['code']
            if cc not in nodes:
                nodes[cc] = {'id': cc, 'kind': 'subject', 'label': course.get('name') or cc, 'cr': num(course.get('credit'))}
            choice = (course.get('studyChoice') or {}).get('code')
            edge(cc, gt, 'member', True, q={'role': CHOICE.get(choice, choice or 'unknown'),
                 'choice': (course.get('studyChoice') or {}).get('name'), 'period': int(period)},
                 ev=('ntnu-study-plan', 'studyplan-json', 1))


for f in sorted((CACHE / 'plans').glob('*.json')):
    try:
        sp = json.loads(f.read_text())['studyplan']
    except (TypeError, KeyError, json.JSONDecodeError):
        continue
    if not sp:
        continue
    plan = f"{sp['code']}-{sp['year']}"
    pt = tag('programme', plan, f"{sp['name']} ({sp['year']})", 'kind:programme')
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
