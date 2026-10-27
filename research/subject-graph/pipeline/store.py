"""Content-addressed store for the subject-graph pipeline.

Three ideas, borrowed from build systems (Nix, Bazel, Shake, Salsa):

  evidence   every upstream response is stored once, by sha256 of its raw bytes, with a manifest row
             (url, params, fetched_at, status). Raw bytes are kept for audit and re-parsing.
  artifacts  every derived thing has a key (what it is) and an input hash (what it was made from,
             including the code version that made it). If the input hash matches the last run,
             the stored output is reused. If a recomputed output hashes the same as before,
             propagation stops there ("early cutoff").
  revisions  a published graph is a Merkle root over the hashes of its nodes and edges, so two
             revisions can be compared cheaply and every result can cite the revision it came from.

Layout:  .cache/evidence/ab/cdef...gz   blobs
         .cache/store.duckdb             evidence, artifacts, deps, revisions, revision_items
"""
from __future__ import annotations

import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
BLOBS = CACHE / 'evidence'


def h(*parts) -> str:
    """Stable hash of strings, bytes or JSON-serialisable values."""
    m = hashlib.sha256()
    for p in parts:
        if isinstance(p, bytes):
            b = p
        elif isinstance(p, str):
            b = p.encode()
        else:
            b = json.dumps(p, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()
        m.update(len(b).to_bytes(8, 'big'))
        m.update(b)
    return m.hexdigest()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


class Store:
    def __init__(self, path: Path = CACHE / 'store.duckdb'):
        CACHE.mkdir(exist_ok=True)
        self.db = duckdb.connect(str(path))
        self.db.execute("""
          create table if not exists evidence (
            hash text primary key, url text, params text, fetched_at text, status int, size int, source text);
          create table if not exists fetches (
            url text, params text, fetched_at text, hash text, source text, key text);
          create table if not exists artifacts (
            stage text, key text, input_hash text, output_hash text, version text, computed_at text, value text,
            primary key (stage, key));
          create table if not exists deps (stage text, key text, dep_stage text, dep_key text);
          create table if not exists revisions (
            root text, parent text, created_at text, counts text, diff text);  -- append-only log; a root can recur after a revert
          create table if not exists revision_items (root text, kind text, key text, hash text);
        """)
        if self.db.execute("select count(*) from duckdb_constraints() where table_name = 'revisions' and constraint_type = 'PRIMARY KEY'").fetchall()[0][0]:
            self.db.execute('create table revisions_log as select * from revisions; drop table revisions; alter table revisions_log rename to revisions')

    # ---------- evidence ----------
    def put_evidence(self, body: bytes, *, url: str, params=None, status: int = 200, source: str, key: str,
                     fetched_at: str | None = None) -> str:
        eid = h(body)
        blob = BLOBS / eid[:2] / f'{eid[2:]}.gz'
        if not blob.exists():
            blob.parent.mkdir(parents=True, exist_ok=True)
            blob.write_bytes(gzip.compress(body, 6))
        ts = fetched_at or now()
        p = json.dumps(params or {}, sort_keys=True)
        self.db.execute('insert into evidence values (?, ?, ?, ?, ?, ?, ?) on conflict do nothing',
                        [eid, url, p, ts, status, len(body), source])
        self.db.execute('insert into fetches values (?, ?, ?, ?, ?, ?)', [url, p, ts, eid, source, key])
        return eid

    def get_evidence(self, eid: str) -> bytes:
        return gzip.decompress((BLOBS / eid[:2] / f'{eid[2:]}.gz').read_bytes())

    def latest_evidence(self, source: str) -> dict[str, str]:
        """Most recent evidence hash per key for a source (e.g. key 'TDT4100/2026')."""
        rows = self.db.execute("""
          select key, hash from (
            select key, hash, row_number() over (partition by key order by fetched_at desc) r
            from fetches where source = ?) where r = 1""", [source]).fetchall()
        return dict(rows)

    # ---------- memoised artifacts ----------
    def memo(self, stage: str, key: str):
        r = self.db.execute('select input_hash, output_hash, value from artifacts where stage = ? and key = ?',
                            [stage, key]).fetchall()  # fetchall: DuckDB 2 blocks the connection on a half-read result
        return r[0] if r else None

    def memo_all(self, stage: str) -> dict[str, tuple[str, str, str]]:
        return {k: (i, o, v) for k, i, o, v in self.db.execute(
            'select key, input_hash, output_hash, value from artifacts where stage = ?', [stage]).fetchall()}

    def record(self, stage: str, rows: list[tuple[str, str, str, str, str]]):
        """rows: (key, input_hash, output_hash, version, value-json)."""
        if not rows:
            return
        ts = now()
        if len(rows) < 500:
            self.db.executemany('insert or replace into artifacts values (?, ?, ?, ?, ?, ?, ?)',
                                [(stage, k, i, o, v, ts, val) for k, i, o, v, val in rows])
            return
        import pandas as pd
        df = pd.DataFrame([(stage, k, i, o, v, ts, val) for k, i, o, v, val in rows],
                          columns=['stage', 'key', 'input_hash', 'output_hash', 'version', 'computed_at', 'value'])
        self.db.register('new_rows', df)
        self.db.execute('insert or replace into artifacts select * from new_rows')
        self.db.unregister('new_rows')

    def set_deps(self, stage: str, edges: list[tuple[str, str, str]]):
        """edges: (key, dep_stage, dep_key). Replaces the stage's dependency rows."""
        self.db.execute('delete from deps where stage = ?', [stage])
        if edges:
            self.db.executemany('insert into deps values (?, ?, ?, ?)', [(stage, k, ds, dk) for k, ds, dk in edges])

    # ---------- revisions ----------
    def last_revision(self):
        r = self.db.execute('select root from revisions order by created_at desc limit 1').fetchall()
        return r[0] if r else None

    def publish(self, items: dict[str, dict[str, str]]):
        """items: {kind: {key: hash}}. Returns (root, diff). Idempotent for an identical graph."""
        leaves = sorted(f'{kind}\t{k}\t{v}' for kind, kv in items.items() for k, v in kv.items())
        level = [h(x) for x in leaves] or [h('')]
        while len(level) > 1:  # binary Merkle tree over sorted leaves
            level = [h(*level[i:i + 2]) for i in range(0, len(level), 2)]
        root = level[0]
        prev = self.last_revision()
        if prev and prev[0] == root:
            return root, None
        self.db.execute('begin transaction')  # the log row and its items land together or not at all
        try:
            out = self._publish(root, prev, items)
            self.db.execute('commit')
            return out
        except Exception:
            self.db.execute('rollback')
            raise

    def _publish(self, root, prev, items):
        diff = {}
        if prev:
            old = {}
            for kind, k, v in self.db.execute('select kind, key, hash from revision_items where root = ?', [prev[0]]).fetchall():
                old.setdefault(kind, {})[k] = v
            for kind in set(items) | set(old):
                a, b = old.get(kind, {}), items.get(kind, {})
                diff[kind] = {'added': sorted(set(b) - set(a)), 'removed': sorted(set(a) - set(b)),
                              'changed': sorted(k for k in set(a) & set(b) if a[k] != b[k])}
        counts = {kind: len(kv) for kind, kv in items.items()}
        self.db.execute('insert into revisions values (?, ?, ?, ?, ?)',
                        [root, prev[0] if prev else None, now(), json.dumps(counts), json.dumps(diff)])
        if self.db.execute('select count(*) from revision_items where root = ?', [root]).fetchall()[0][0]:
            return root, diff  # a revert to a known revision: its items are already stored
        import pandas as pd  # bulk insert; executemany is row-by-row in DuckDB
        rows = pd.DataFrame([(root, kind, k, v) for kind, kv in items.items() for k, v in kv.items()],
                            columns=['root', 'kind', 'key', 'hash'])
        self.db.register('new_items', rows)
        self.db.execute('insert into revision_items select * from new_items')
        self.db.unregister('new_items')
        return root, diff
