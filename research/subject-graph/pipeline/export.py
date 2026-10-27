"""Write the compact, committed graph (data/graph.json) and, optionally, a private viewer bundle.

Compact format (tables instead of repeated strings):
  nodes:  [id, kind(0 subject|1 tag), label, attrs]
  kinds:  [[name, directed], ...]
  ev:     [[source, method, confidence], ...]
  edges:  [s, t, kindIndex, w|null, evIndex, q?]
The personal plan (.cache/personal.json) is merged only into the private viewer bundle, never into data/.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
g = json.loads((ROOT / '.cache/graph.json').read_text())


def compact(graph):
    ids = [n['id'] for n in graph['nodes']]
    at = {i: k for k, i in enumerate(ids)}
    nodes = [[n['id'], 0 if n['kind'] == 'subject' else 1, n.get('label'),
              {k: v for k, v in n.items() if k not in ('id', 'kind', 'label')}] for n in graph['nodes']]
    kinds, ev, edges = {}, {}, []
    for e in graph['edges']:
        if e['s'] not in at or e['t'] not in at:
            continue
        k = kinds.setdefault((e['kind'], e['directed']), len(kinds))
        v = ev.setdefault(tuple(e['ev']), len(ev))
        row = [at[e['s']], at[e['t']], k, e['w'], v]
        if e['q']:
            row.append(e['q'])
        edges.append(row)
    return {'meta': graph['meta'], 'nodes': nodes, 'kinds': [list(k) for k in kinds], 'ev': [list(v) for v in ev], 'edges': edges}


def with_personal(graph):
    p = json.loads((ROOT / '.cache/personal.json').read_text())
    graph = {**graph, 'nodes': list(graph['nodes']), 'edges': list(graph['edges'])}
    graph['nodes'].append({'id': 'kind:plan', 'kind': 'tag', 'ns': 'kind', 'label': 'Personal plan'})
    graph['nodes'].append({'id': p['id'], 'kind': 'tag', 'ns': 'plan', 'label': p['label']})
    graph['edges'].append({'s': p['id'], 't': 'kind:plan', 'kind': 'part_of', 'directed': True, 'w': None, 'q': {}, 'ev': ['structure', 'derived', 1]})
    for code, term, grade in p['completed']:
        graph['edges'].append({'s': p['id'], 't': code, 'kind': 'completed', 'directed': True, 'w': None,
                               'q': {'term': term, 'grade': grade}, 'ev': ['transcript', 'student-authored', 1]})
    for code, term in p['current']:
        graph['edges'].append({'s': p['id'], 't': code, 'kind': 'taking', 'directed': True, 'w': None,
                               'q': {'term': term}, 'ev': ['student', 'student-authored', 1]})
    for code, note in p['credited_elsewhere']:
        graph['edges'].append({'s': p['id'], 't': code, 'kind': 'credited', 'directed': True, 'w': None,
                               'q': {'note': note}, 'ev': ['student', 'student-authored', 1]})
    return graph


(ROOT / 'data').mkdir(exist_ok=True)
public = compact(g)
(ROOT / 'data/graph.json').write_text(json.dumps(public, ensure_ascii=False, separators=(',', ':')))
print('data/graph.json', round(len(json.dumps(public, ensure_ascii=False, separators=(',', ':'))) / 1e6, 1), 'MB')
if '--private' in sys.argv:
    private = compact(with_personal(g))
    (ROOT / '.cache/viewer-data.json').write_text(json.dumps(private, ensure_ascii=False, separators=(',', ':')))
    print('.cache/viewer-data.json written (includes personal plan)')
