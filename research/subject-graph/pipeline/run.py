"""Run the pipeline as a chain of memoised stages.

A stage's input hash is H(its own source code, the stages and modules it imports from this folder, and the
contents of its input files). If that matches the last successful run, the stage is skipped. If a stage
re-runs but writes byte-identical outputs, the next stage's input hash is unchanged and it is skipped too
(early cutoff). Inside stages, ingest.py and enrich.py memoise per subject.

Usage: python3 pipeline/run.py [--private]
"""
import subprocess
import sys
import time
from pathlib import Path

from store import CACHE, ROOT, Store, h

HERE = Path(__file__).resolve().parent
PRIVATE = '--private' in sys.argv
STAGES = [
    # name, command, code files, input files, output files
    ('ingest', ['pipeline/ingest.py'], ['ingest.py', 'parse_pages.py', 'store.py'], ['@evidence:ntnu-course-page'], ['.cache/courses.json']),
    ('build', ['pipeline/build_graph.py'], ['build_graph.py', 'store.py'], ['.cache/courses.json', '@evidence:ntnu-study-plan'], ['.cache/graph_base.json']),
    ('enrich', ['pipeline/enrich.py'], ['enrich.py', 'store.py'], ['.cache/graph_base.json', '.cache/courses.json', '.cache/pass_all.json'], ['.cache/graph.json']),
    ('export', ['pipeline/export.py'] + (['--private'] if PRIVATE else []), ['export.py', 'store.py'], ['.cache/graph.json'] + (['.cache/personal.json'] if PRIVATE else []), ['data/graph.json']),
    ('viewer', ['viewer/build.py'] + (['--private'] if PRIVATE else []), ['../viewer/build.py', '../viewer/template.html'], ['data/graph.json'] + (['.cache/viewer-data.json'] if PRIVATE else []), []),
]


def file_hash(p):
    f = ROOT / p
    return h(f.read_bytes()) if f.exists() else 'missing'


store = Store()
for name, cmd, code, inputs, outputs in STAGES:
    parts = [h((HERE / c).read_bytes()) for c in code]
    for i in inputs:
        if i.startswith('@evidence:'):  # the latest evidence per key for a source
            parts.append(h(sorted(store.latest_evidence(i.split(':', 1)[1]).items())))
        else:
            parts.append(file_hash(i))
    key = name + ('-private' if PRIVATE else '')
    inp = h(parts)
    prev = store.memo('stage', key)
    if prev and prev[0] == inp and all((ROOT / o).exists() for o in outputs):
        print(f'{name:7} skipped (inputs unchanged)')
        continue
    t0 = time.time()
    store.db.close()  # stages open the store themselves
    r = subprocess.run([sys.executable, *cmd], cwd=ROOT, capture_output=True, text=True)
    store = Store()
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-4000:])
        sys.exit(f'{name} failed')
    out = h([file_hash(o) for o in outputs])
    store.record('stage', [(key, inp, out, 'run-v1', '{}')])
    note = [l for l in (r.stdout + r.stderr).splitlines() if l.strip() and 'warn' not in l.lower() and 'Loading weights' not in l][-4:]
    print(f'{name:7} ran {time.time() - t0:5.1f}s ' + ' | '.join(note))
