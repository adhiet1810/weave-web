-- One-project-at-a-time model.
--   vault_id 'default'  = your working project (opens empty)
--   vault_id 'example'  = the read-only "Cut my food spending" template that
--                         "Load example" clones into 'default' on demand.
CREATE TABLE IF NOT EXISTS projects (
  vault_id TEXT PRIMARY KEY,
  name TEXT,
  created TEXT
);

-- Move any seeded rows (from 0002, which loaded into 'default') into the
-- example template, so the working project starts blank. Safe to re-run:
-- after the first pass there are no 'default' rows left to move.
UPDATE nodes    SET vault_id='example' WHERE vault_id='default';
UPDATE facets   SET vault_id='example' WHERE vault_id='default';
UPDATE edges    SET vault_id='example' WHERE vault_id='default';
UPDATE captures SET vault_id='example' WHERE vault_id='default';

-- Register both projects (idempotent).
INSERT OR IGNORE INTO projects (vault_id, name, created) VALUES ('default', 'Untitled', datetime('now'));
INSERT OR IGNORE INTO projects (vault_id, name, created) VALUES ('example', 'Cut my food spending (example)', datetime('now'));
