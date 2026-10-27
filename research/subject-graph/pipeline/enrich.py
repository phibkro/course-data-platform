"""Enrich the base graph: text embeddings, similarity edges, 2D layout, communities, pass rates.

Derived edges and tags carry their method and version in `ev` so they can be told apart from
published facts. Outputs .cache/graph.json; export.py writes the committed compact form.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
EMB_MODEL = 'intfloat/multilingual-e5-small'  # multilingual (NTNU pages mix Norwegian and English); inputs need a 'query: ' prefix
K, MIN_SIM = 6, 0.80  # e5 cosines sit higher than MiniLM's; floor re-tuned

g = json.loads((CACHE / 'graph_base.json').read_text())
courses = {}
for c in json.loads((CACHE / 'courses.json').read_text()):
    if c['code'] not in courses or c['year'] > courses[c['code']]['year']:
        courses[c['code']] = c
nodes = {n['id']: n for n in g['nodes']}
edges = g['edges']

# 1. Embeddings over what the course teaches (name, content, learning outcomes); boilerplate excluded.
#    Memoised per text: key = H(model, text). Only new or changed course texts are embedded.
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from store import Store, h
store = Store()
store.db.execute('create table if not exists embeddings (hash text primary key, vec blob)')
codes = [c for c in courses if courses[c].get('content') or courses[c].get('outcomes')]
texts = ['query: ' + ' '.join(filter(None, [courses[c]['name'], courses[c].get('content'), courses[c].get('outcomes')]))[:2000] for c in codes]
thash = [h(EMB_MODEL, t) for t in texts]
legacy, legacy_codes = CACHE / 'embeddings-e5small.npy', CACHE / 'embeddings-e5small.codes.json'
if legacy.exists() and legacy_codes.exists() and not store.db.execute('select count(*) from embeddings').fetchall()[0][0]:
    # one-off: seed the memo from the earlier full run (same texts, same model)
    L, lc = np.load(legacy), json.loads(legacy_codes.read_text())
    pos = {c: i for i, c in enumerate(lc)}
    store.db.executemany('insert or ignore into embeddings values (?, ?)', [(th, L[pos[c]].astype(np.float32).tobytes()) for c, th in zip(codes, thash) if c in pos])
have = dict(store.db.execute('select hash, vec from embeddings').fetchall())
missing = [k for k, th in enumerate(thash) if th not in have]
if missing:
    from sentence_transformers import SentenceTransformer
    V = SentenceTransformer(EMB_MODEL).encode([texts[k] for k in missing], batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    store.db.executemany('insert or ignore into embeddings values (?, ?)', [(thash[k], v.astype(np.float32).tobytes()) for k, v in zip(missing, V)])
    have.update({thash[k]: v.astype(np.float32).tobytes() for k, v in zip(missing, V)})
E = np.stack([np.frombuffer(have[th], dtype=np.float32) for th in thash])
print(f'embeddings: {len(codes) - len(missing)} reused, {len(missing)} computed', file=sys.stderr)
index = {c: i for i, c in enumerate(codes)}

# 2. Similarity edges: top-K neighbours above a floor, undirected, weight = cosine.
S = E @ E.T
np.fill_diagonal(S, -1)
pairs = set()
for i, c in enumerate(codes):
    for j in np.argsort(-S[i])[:K]:
        if S[i, j] >= MIN_SIM:
            pairs.add(tuple(sorted((i, int(j)))))
for i, j in pairs:
    edges.append({'s': codes[i], 't': codes[j], 'kind': 'similar', 'directed': False, 'w': round(float(S[i, j]), 3),
                  'q': {}, 'ev': [EMB_MODEL, f'knn-k{K}-min{MIN_SIM}-v1', round(float(S[i, j]), 2)]})

# 3. Layout: UMAP on embeddings (cosine). Kept stable across revisions: when few texts changed, existing
#    subjects keep their place and new or changed ones are placed among their nearest unchanged neighbours.
#    A full re-fit happens on first run or when more than REFIT_SHARE of the texts changed.
REFIT_SHARE = 0.15
# Every position ever given to a (subject, text) pair is kept, so reverting a page restores its old place.
store.db.execute('create table if not exists layout_positions (code text, text_hash text, xy text, primary key (code, text_hash))')
known = {(c, t): json.loads(xy) for c, t, xy in store.db.execute('select code, text_hash, xy from layout_positions').fetchall()}
unchanged = [k for k, c in enumerate(codes) if (c, thash[k]) in known]
if known and len(codes) - len(unchanged) <= REFIT_SHARE * len(codes):
    XY = np.zeros((len(codes), 2))
    U = np.array(unchanged)
    for k in range(len(codes)):
        if (codes[k], thash[k]) in known:
            XY[k] = known[(codes[k], thash[k])]
        else:
            sims = E[U] @ E[k]
            top = np.argsort(-sims)[:5]
            w = np.maximum(sims[top], 1e-3)
            XY[k] = np.array([known[(codes[U[t]], thash[U[t]])] for t in top]).T @ w / w.sum()
    layout_mode = f'placed {len(codes) - len(unchanged)} into the previous layout'
else:
    import umap
    XY = umap.UMAP(n_neighbors=15, min_dist=0.08, metric='cosine', random_state=7).fit_transform(E)
    XY = (XY - XY.mean(0)) / XY.std(0)
    layout_mode = 'full UMAP fit'
for c, (x, y) in zip(codes, XY):
    nodes[c]['x'], nodes[c]['y'] = round(float(x), 3), round(float(y), 3)
if layout_mode == 'full UMAP fit':
    store.db.execute('delete from layout_positions')  # a re-fit is a new coordinate system
import pandas as pd
store.db.register('pos', pd.DataFrame([(c, thash[k], json.dumps([nodes[c]['x'], nodes[c]['y']])) for k, c in enumerate(codes)], columns=['code', 'text_hash', 'xy']))
store.db.execute('insert or ignore into layout_positions select * from pos')
store.db.unregister('pos')
print('layout:', layout_mode, file=sys.stderr)

# 4. Communities over relational structure: similarity + overlap + prerequisites (Leiden, modularity).
#    Warm start: Leiden begins from the previous revision's partition and only moves nodes where modularity
#    improves, so one changed course does not reshuffle unrelated communities. COLD=1 recomputes from scratch.
#    leidenalg (Traag's reference implementation) is used because networkx's Leiden takes no initial partition.
import os
import igraph as ig
import leidenalg
weights = {'similar': 1.0, 'overlaps': 1.5, 'requires': 1.0, 'recommends': 0.6}
vid = {c: i for i, c in enumerate(sorted(codes))}  # integer ids in sorted order: deterministic across processes
W = defaultdict(float)
for e in edges:
    if e['kind'] in weights and e['s'] in index and e['t'] in index and e['s'] != e['t']:
        a, b = sorted((vid[e['s']], vid[e['t']]))
        W[(a, b)] += weights[e['kind']] * (e['w'] if e['kind'] == 'similar' else 1.0)
pairs_w = sorted(W.items())
IG = ig.Graph(n=len(vid), edges=[p for p, _ in pairs_w])
IG.es['weight'] = [w for _, w in pairs_w]
prev_comm = {k: json.loads(v) for k, (i, o, v) in store.memo_all('community').items()}
# Content-addressed partitions: the result is stored under the hash of the weighted graph it was computed
# on. An unchanged graph (or one reverted to an earlier state) reuses its partition instead of re-running
# Leiden, whose warm restarts otherwise keep nudging a few nodes as modularity creeps up.
graph_hash = h(names := sorted(vid), [(a, b, round(w, 6)) for (a, b), w in pairs_w])
store.db.execute('create table if not exists partitions (graph_hash text primary key, assignment text)')
hit = store.db.execute('select assignment from partitions where graph_hash = ?', [graph_hash]).fetchall()
if hit and os.environ.get('COLD') != '1':
    groups = defaultdict(set)
    for c, k in json.loads(hit[0][0]).items():
        groups[k].add(c)
    stored = sorted(groups.items(), key=lambda kv: (-len(kv[1]), min(kv[1])))
    communities, mode = [c for _, c in stored], 'reused (community graph unchanged or reverted)'
else:
    stored = None
    warm = bool(prev_comm) and os.environ.get('COLD') != '1'
    init = None
    if warm:
        spare = iter(range(max(prev_comm.values()) + 1, 10**9))
        init = [prev_comm[c] if c in prev_comm else next(spare) for c in names]  # unassigned courses start alone
    part = leidenalg.find_partition(IG, leidenalg.ModularityVertexPartition, weights='weight', initial_membership=init,
                                    n_iterations=-1, seed=7)
    communities = [{names[v] for v in comm} for comm in part]
    mode = f'{"warm start from previous partition" if warm else "cold start"}, modularity {part.modularity:.4f}'
communities = sorted([c for c in communities if len(c) >= 8], key=lambda c: (-len(c), min(c)))
print('communities:', mode, file=sys.stderr)
# Keep community identities (and so colours) stable across revisions: match each new community to the
# previous one it shares most members with; unmatched communities get fresh numbers.
order, used = [], set()
for comm in ([] if stored else communities):
    votes = {}
    for c in comm:
        if c in prev_comm:
            votes[prev_comm[c]] = votes.get(prev_comm[c], 0) + 1
    best = max((v for v in votes if v not in used), key=lambda v: votes[v], default=None)
    if best is not None and votes[best] >= len(comm) * 0.3:
        used.add(best)
        order.append((best, comm))
    else:
        order.append((None, comm))
fresh = iter(n for n in range(10_000) if n not in used and n not in set(prev_comm.values()))
order = [(n if n is not None else next(fresh), comm) for n, comm in order] if not stored else stored
store.db.execute('insert or replace into partitions values (?, ?)', [graph_hash, json.dumps({c: k for k, comm in order for c in sorted(comm)}, sort_keys=True)])

# Label each community by its most distinctive title words (class-based term frequency).
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
NORWEGIAN = 'og i det som en til er av på for med at ikke den har de vil kan om ved fra eller skal også blir være emnet emne studentene studenten kunnskap ferdigheter kompetanse gjennom innen samt etter under hvordan dette disse denne andre mellom'.split()
COURSEWORD = 'introduction advanced course courses project fundamentals basic basics theory theories methods method applied special topics selected master thesis part syllabus specialization specialisation internship module studies further education experts teamwork village students student knowledge skills general competence understanding able topics include including main within based different various will work using use used provide given give learn learning teaching including also well related relevant'.split()
STOP = set(ENGLISH_STOP_WORDS) | set(NORWEGIAN) | set(COURSEWORD)
df = Counter()
docs = []
for comm in communities:
    words = Counter(w for c in sorted(comm) for w in re.findall(r'[a-zæøå]{4,}', (nodes[c]['label'] + ' ' + (courses[c].get('content') or '')[:600]).lower()) if w not in STOP)
    docs.append(words)
    df.update(set(words))
store.db.execute("delete from artifacts where stage = 'community'")  # members that left every community must not keep a stale id
kind_tag = 'clustering:community'
nodes[kind_tag] = {'id': kind_tag, 'kind': 'cluster', 'ns': 'clustering', 'label': 'Discovered community'}
for (k, comm), words in zip(order, docs):
    score = {w: n * np.log(len(docs) / df[w]) for w, n in words.items()}
    top = [w for w, _ in sorted(score.items(), key=lambda kv: (-round(kv[1], 9), kv[0]))[:3]]  # ties by word, not set order
    tid = f'community:{k}'
    nodes[tid] = {'id': tid, 'kind': 'cluster', 'ns': 'community', 'label': ' · '.join(top), 'size': len(comm)}
    edges.append({'s': tid, 't': kind_tag, 'kind': 'part_of', 'directed': True, 'w': None, 'q': {}, 'ev': ['structure', 'derived', 1]})
    store.record('community', [(c, h(sorted(comm)), str(k), 'leidenalg-modularity-warm-seed7', json.dumps(k)) for c in comm])
    for c in comm:
        edges.append({'s': c, 't': tid, 'kind': 'in_cluster', 'directed': True, 'w': None, 'q': {},
                      'ev': ['graph', 'leidenalg-sim+overlap+prereq-warm-seed7-v2', 0.5]})

# 5. Exam outcomes from DBH tables 308 and 905 (pipeline/outcomes.py), most recent three reported years.
#    pass = [passed, graded]; pass_range = bounds given DBH's suppressed 0-2 cells; grades = A..F, G, H counts.
outcomes = json.loads((CACHE / 'outcomes.json').read_text())
for code, o in outcomes['courses'].items():
    if code in nodes:
        nodes[code]['pass'] = [o['passed'], o['graded']]
        nodes[code]['pass_range'] = o['pass_range']
        nodes[code]['grades'] = o['grades']

# 6. Set trajectories: per programme, the layout centroid of its members by study period.
member_period = defaultdict(lambda: defaultdict(list))
parent = {e['s']: e['t'] for e in edges if e['kind'] == 'part_of'}
def root_programme(t):
    while t in parent and not t.startswith('programme:'):
        t = parent[t]
    return t if t.startswith('programme:') else None
for e in edges:
    if e['kind'] == 'in_cluster' and 'period' in e['q'] and 'x' in nodes.get(e['s'], {}):
        p = root_programme(e['t'])
        if p:
            member_period[p][e['q']['period']].append((nodes[e['s']]['x'], nodes[e['s']]['y']))
for p, periods in member_period.items():
    nodes[p]['path'] = [[k, round(float(np.mean([a for a, _ in v])), 3), round(float(np.mean([b for _, b in v])), 3)]
                        for k, v in sorted(periods.items())]

out = {'meta': {'built': 'from .cache via pipeline/*.py', 'embedding': EMB_MODEL, 'layout': 'umap-cosine-15-0.08-seed7',
                'clusters': 'leidenalg modularity, warm-started from the previous revision, seed 7, min size 8, c-TF-IDF labels over title+content', 'pass_rates': 'DBH tables 308+905 (HK-dir), NTNU, ' + '-'.join(map(str, outcomes['meta']['window']))},
       'nodes': list(nodes.values()), 'edges': edges}
(ROOT / 'data').mkdir(exist_ok=True)
(CACHE / 'graph.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(len(out['nodes']), 'nodes;', len(edges), 'edges;', len(pairs), 'similar;', len(communities), 'clusters;',
      sum('x' in n for n in nodes.values()), 'placed')
for k, comm in order[:12]:
    print(' ', k, nodes[f'community:{k}']['size'], nodes[f'community:{k}']['label'])
