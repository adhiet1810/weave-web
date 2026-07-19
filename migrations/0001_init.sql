-- Weave D1 schema. One workspace ("default") in v1.
CREATE TABLE IF NOT EXISTS nodes (
  vault_id TEXT NOT NULL DEFAULT 'default',
  id TEXT NOT NULL,
  kind TEXT,
  state TEXT NOT NULL DEFAULT 'freeform',
  region TEXT,
  lean TEXT NOT NULL DEFAULT 'inherit',
  cluster TEXT,
  title TEXT,
  distillate_text TEXT,
  distillate_confidence REAL,
  distillate_updated TEXT,
  body TEXT,
  created TEXT,
  updated TEXT,
  PRIMARY KEY (vault_id, id)
);
CREATE TABLE IF NOT EXISTS facets (
  vault_id TEXT NOT NULL DEFAULT 'default',
  node_id TEXT NOT NULL,
  name TEXT NOT NULL,
  semantic TEXT,
  distillate TEXT,
  confidence REAL,
  PRIMARY KEY (vault_id, node_id, name)
);
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id TEXT NOT NULL DEFAULT 'default',
  src TEXT NOT NULL,
  from_facet TEXT,
  to_id TEXT NOT NULL,
  to_facet TEXT,
  rel TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS captures (
  vault_id TEXT NOT NULL DEFAULT 'default',
  id TEXT NOT NULL,
  text TEXT NOT NULL,
  created TEXT,
  PRIMARY KEY (vault_id, id)
);
CREATE INDEX IF NOT EXISTS idx_edges_vault ON edges(vault_id);
CREATE INDEX IF NOT EXISTS idx_facets_node ON facets(vault_id, node_id);
