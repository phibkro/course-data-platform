"""Enrich the base graph: text embeddings, similarity edges, 2D layout, communities, pass rates.

Derived edges and tags carry their method and version in `ev` so they can be told apart from
published facts. Outputs .cache/graph.json; export.py writes the committed compact form.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import networkx as nx
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
EMB_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
K, MIN_SIM = 6, 0.55

g = json.loads((CACHE / 'graph_base.json').read_text())
courses = {c['code']: c for c in json.loads((CACHE / 'courses.json').read_text())}
nodes = {n['id']: n for n in g['nodes']}
edges = g['edges']

# 1. Embeddings over what the course teaches (name, content, learning outcomes); boilerplate excluded.
codes = [c for c in courses if courses[c].get('content') or courses[c].get('outcomes')]
texts = [' '.join(filter(None, [courses[c]['name'], courses[c].get('content'), courses[c].get('outcomes')]))[:2000] for c in codes]
emb_path = CACHE / 'embeddings.npy'
if emb_path.exists() and (CACHE / 'embeddings.codes.json').exists() and json.loads((CACHE / 'embeddings.codes.json').read_text()) == codes:
    E = np.load(emb_path)
else:
    from sentence_transformers import SentenceTransformer
    E = SentenceTransformer(EMB_MODEL).encode(texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    np.save(emb_path, E)
    (CACHE / 'embeddings.codes.json').write_text(json.dumps(codes))
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

# 3. Layout: UMAP on embeddings (cosine). Subjects without text stay unplaced (shown in lists, not on the map).
import umap
XY = umap.UMAP(n_neighbors=15, min_dist=0.08, metric='cosine', random_state=7).fit_transform(E)
XY = (XY - XY.mean(0)) / XY.std(0)
for c, (x, y) in zip(codes, XY):
    nodes[c]['x'], nodes[c]['y'] = round(float(x), 3), round(float(y), 3)

# 4. Communities over relational structure: similarity + overlap + prerequisites (Louvain, fixed seed).
G = nx.Graph()
G.add_nodes_from(codes)
weights = {'similar': 1.0, 'overlaps': 1.5, 'requires': 1.0, 'recommends': 0.6}
for e in edges:
    if e['kind'] in weights and e['s'] in index and e['t'] in index:
        w = weights[e['kind']] * (e['w'] if e['kind'] == 'similar' else 1.0)
        G.add_edge(e['s'], e['t'], weight=G.get_edge_data(e['s'], e['t'], {'weight': 0})['weight'] + w)
communities = nx.community.louvain_communities(G, weight='weight', resolution=1.0, seed=7)
communities = sorted([c for c in communities if len(c) >= 8], key=len, reverse=True)

# Label each community by its most distinctive title words (class-based term frequency).
STOP = set('and or of the in for to with a an i og til med av på introduction advanced course project fundamentals basic basics theory methods applied special topics selected master thesis i ii iii part syllabus specialization specialisation internship module studies course further education experts teamwork village'.split())
df = Counter()
docs = []
for comm in communities:
    words = Counter(w for c in comm for w in re.findall(r'[a-zæøå]{3,}', nodes[c]['label'].lower()) if w not in STOP)
    docs.append(words)
    df.update(set(words))
kind_tag = 'kind:cluster'
nodes[kind_tag] = {'id': kind_tag, 'kind': 'tag', 'ns': 'kind', 'label': 'Discovered cluster'}
for k, (comm, words) in enumerate(zip(communities, docs)):
    score = {w: n * np.log(len(docs) / df[w]) for w, n in words.items()}
    top = [w for w, _ in sorted(score.items(), key=lambda kv: -kv[1])[:3]]
    tid = f'cluster:{k}'
    nodes[tid] = {'id': tid, 'kind': 'tag', 'ns': 'cluster', 'label': ' · '.join(top), 'size': len(comm)}
    edges.append({'s': tid, 't': kind_tag, 'kind': 'part_of', 'directed': True, 'w': None, 'q': {}, 'ev': ['structure', 'derived', 1]})
    for c in comm:
        edges.append({'s': c, 't': tid, 'kind': 'in_cluster', 'directed': True, 'w': None, 'q': {},
                      'ev': ['graph', 'louvain-sim+overlap+prereq-seed7-v1', 0.5]})

# 5. Outcome statistics (grades.no, 2023-25) where collected.
pass_path = CACHE / 'pass_all.json'
if pass_path.exists():
    for code, (sat, passed, years) in json.loads(pass_path.read_text()).items():
        if code in nodes and sat:
            nodes[code]['pass'] = [passed, sat]

# 6. Set trajectories: per programme, the layout centroid of its members by study period.
member_period = defaultdict(lambda: defaultdict(list))
parent = {e['s']: e['t'] for e in edges if e['kind'] == 'part_of'}
def root_programme(t):
    while t in parent and not t.startswith('programme:'):
        t = parent[t]
    return t if t.startswith('programme:') else None
for e in edges:
    if e['kind'] == 'member' and 'x' in nodes.get(e['s'], {}):
        p = root_programme(e['t'])
        if p:
            member_period[p][e['q']['period']].append((nodes[e['s']]['x'], nodes[e['s']]['y']))
for p, periods in member_period.items():
    nodes[p]['path'] = [[k, round(float(np.mean([a for a, _ in v])), 3), round(float(np.mean([b for _, b in v])), 3)]
                        for k, v in sorted(periods.items())]

out = {'meta': {'built': 'from .cache via pipeline/*.py', 'embedding': EMB_MODEL, 'layout': 'umap-cosine-15-0.08-seed7',
                'clusters': 'louvain seed 7, min size 8', 'pass_rates': 'grades.no 2023-25 where collected'},
       'nodes': list(nodes.values()), 'edges': edges}
(ROOT / 'data').mkdir(exist_ok=True)
(CACHE / 'graph.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(len(out['nodes']), 'nodes;', len(edges), 'edges;', len(pairs), 'similar;', len(communities), 'clusters;',
      sum('x' in n for n in nodes.values()), 'placed')
for k in range(min(12, len(communities))):
    print(' ', nodes[f'cluster:{k}']['size'], nodes[f'cluster:{k}']['label'])
