"""Write the compact, committed graph (data/graph.json) and, optionally, a private viewer bundle.

Compact format (tables instead of repeated strings):
  nodes:  [id, kind(0 subject|1 cluster), label, attrs]
  kinds:  [[name, directed], ...]
  ev:     [[source, method, confidence], ...]
  edges:  [s, t, kindIndex, w|null, evIndex, q?]
The public graph is also published as a Merkle revision (pipeline/store.py); data/revision.json records
its root, parent and a diff summary. The personal plan (.cache/personal.json) is merged only into the
private viewer bundle, after publishing, never into data/ or the revision.
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
    graph['nodes'].append({'id': 'clustering:plan', 'kind': 'cluster', 'ns': 'clustering', 'label': 'Personal plan'})
    graph['nodes'].append({'id': p['id'], 'kind': 'cluster', 'ns': 'plan', 'label': p['label']})
    graph['edges'].append({'s': p['id'], 't': 'clustering:plan', 'kind': 'part_of', 'directed': True, 'w': None, 'q': {}, 'ev': ['structure', 'derived', 1]})
    for code, term, grade in p['completed']:
        graph['edges'].append({'s': p['id'], 't': code, 'kind': 'completed', 'directed': True, 'w': None,
                               'q': {'term': term, 'grade': grade}, 'ev': ['transcript', 'student-authored', 1]})
    # Each semester the student took courses becomes a cluster, so it can colour, filter and pull its courses together.
    graph['nodes'].append({'id': 'clustering:taken', 'kind': 'cluster', 'ns': 'clustering', 'label': 'Semester taken (personal)'})
    for code, term, *_ in p['completed'] + [[c, t] for c, t in p['current']]:
        tid = 'taken:' + term.replace(' ', '-')
        if not any(n['id'] == tid for n in graph['nodes']):
            graph['nodes'].append({'id': tid, 'kind': 'cluster', 'ns': 'taken', 'label': term.title()})
            graph['edges'].append({'s': tid, 't': 'clustering:taken', 'kind': 'part_of', 'directed': True, 'w': None, 'q': {}, 'ev': ['structure', 'derived', 1]})
        graph['edges'].append({'s': code, 't': tid, 'kind': 'in_cluster', 'directed': True, 'w': None, 'q': {}, 'ev': ['transcript', 'student-authored', 1]})
    for code, term in p['current']:
        graph['edges'].append({'s': p['id'], 't': code, 'kind': 'taking', 'directed': True, 'w': None,
                               'q': {'term': term}, 'ev': ['student', 'student-authored', 1]})
    for code, note in p['credited_elsewhere']:
        graph['edges'].append({'s': p['id'], 't': code, 'kind': 'credited', 'directed': True, 'w': None,
                               'q': {'note': note}, 'ev': ['student', 'student-authored', 1]})
    return graph


import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from store import Store, h

# A revision is a Merkle root over the hashes of every node and edge in the public graph.
store = Store()
items = {'node': {n['id']: h(n) for n in g['nodes']},
         'edge': {f"{e['s']}|{e['kind']}|{e['t']}": h(e) for e in g['edges']}}
root, diff = store.publish(items)
g['meta'] = {**g['meta'], 'revision': root}
if diff is None:
    print('revision unchanged', root[:12])
else:
    summary = {kind: {k: len(v) for k, v in d.items()} for kind, d in diff.items()}
    subjects = sorted({k for k in diff.get('node', {}).get('changed', []) + diff.get('node', {}).get('added', []) if ':' not in k})
    print('new revision', root[:12], json.dumps(summary), ('subjects changed/added: ' + ', '.join(subjects[:15])) if subjects else '')
    (ROOT / 'data').mkdir(exist_ok=True)
    (ROOT / 'data/revision.json').write_text(json.dumps({'root': root, 'parent': store.db.execute('select parent from revisions where root = ? order by created_at desc', [root]).fetchall()[0][0], 'counts': {k: len(v) for k, v in items.items()}, 'diff_counts': summary, 'subjects_changed_or_added': subjects}, indent=1))

(ROOT / 'data').mkdir(exist_ok=True)
public = compact(g)
(ROOT / 'data/graph.json').write_text(json.dumps(public, ensure_ascii=False, separators=(',', ':')))
print('data/graph.json', round(len(json.dumps(public, ensure_ascii=False, separators=(',', ':'))) / 1e6, 1), 'MB')
if '--private' in sys.argv:
    private = compact(with_personal(g))
    (ROOT / '.cache/viewer-data.json').write_text(json.dumps(private, ensure_ascii=False, separators=(',', ':')))
    print('.cache/viewer-data.json written (includes personal plan)')
