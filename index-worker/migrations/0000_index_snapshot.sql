PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS index_versions (
  version_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'active', 'rejected')),
  build_reason TEXT NOT NULL,
  built_at TEXT NOT NULL,
  activated_at TEXT,
  skill_count INTEGER NOT NULL DEFAULT 0,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  parsed_count INTEGER NOT NULL DEFAULT 0,
  previous_version_id TEXT,
  ranker_version TEXT NOT NULL,
  manifest_key TEXT,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS index_versions_status_built_idx
ON index_versions(status, built_at DESC);

CREATE TABLE IF NOT EXISTS indexed_skills (
  version_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('skills.sh', 'github')),
  source_ref TEXT NOT NULL,
  repository TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  skill_path TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  search_text TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  source_language TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('clear', 'review')),
  license TEXT,
  source_url TEXT NOT NULL,
  skill_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  installs INTEGER,
  r2_key TEXT NOT NULL,
  PRIMARY KEY (version_id, skill_id),
  FOREIGN KEY (version_id) REFERENCES index_versions(version_id)
);

CREATE INDEX IF NOT EXISTS indexed_skills_version_name_idx
ON indexed_skills(version_id, name);

CREATE INDEX IF NOT EXISTS indexed_skills_version_source_idx
ON indexed_skills(version_id, source);

CREATE TABLE IF NOT EXISTS active_index (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  version_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (version_id) REFERENCES index_versions(version_id)
);

CREATE TABLE IF NOT EXISTS source_state (
  source TEXT PRIMARY KEY CHECK (source IN ('skills.sh', 'github')),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'open')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  circuit_open_until TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS sync_runs (
  run_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  version_id TEXT,
  detail_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sync_runs_started_idx
ON sync_runs(started_at DESC);
