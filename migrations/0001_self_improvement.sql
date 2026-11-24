-- CPB-01 evidence store and tamper-evident update journal (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  publisher TEXT,
  authority REAL NOT NULL DEFAULT 0.3,
  family TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  claim TEXT NOT NULL,
  kind TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  evidence_state TEXT NOT NULL DEFAULT 'UNVERIFIED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_evidence (
  item_id TEXT NOT NULL REFERENCES knowledge_items(id),
  source_id TEXT NOT NULL REFERENCES knowledge_sources(id),
  independent_group TEXT NOT NULL,
  PRIMARY KEY(item_id, source_id)
);
CREATE TABLE IF NOT EXISTS update_runs (
  run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  baseline_commit TEXT,
  candidate_commit TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS update_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES update_runs(run_id),
  event TEXT NOT NULL,
  event_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_knowledge_state ON knowledge_items(evidence_state);
CREATE INDEX IF NOT EXISTS idx_update_events_run ON update_events(run_id, sequence);

CREATE TABLE IF NOT EXISTS research_topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT
);
