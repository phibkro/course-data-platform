PRAGMA foreign_keys = ON;

-- Finding A (R3a live run): migration 0006 removes the fixture course seeds and,
-- as collateral, the `no.ntnu` institution row (it is orphaned once the fixture
-- courses are gone on a fresh DB). But `institutions` carries NO source_provider —
-- it is real reference data, not fixture provenance — and the live reconcile path
-- inserts courses/programmes with `institution_id = 'no.ntnu'` under a NOT NULL
-- FOREIGN KEY. On the real migration order (0001..0007 at deploy, before any run)
-- that FK would fail on every programme.
--
-- Re-assert NTNU as permanent reference data so the live serving path is
-- self-sufficient and fixture-independent. Idempotent (INSERT OR IGNORE); leaves
-- reconcile and the publication protocol UNCHANGED.
INSERT OR IGNORE INTO institutions (id, short_name, name, country_code)
VALUES ('no.ntnu', 'NTNU', 'Norwegian University of Science and Technology', 'NO');
