export interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * Migration 001 — Khớp chính xác 13 bảng tại Document/PROJECT_PLAN.md mục 5.
 * Không lưu token/khoá trong bất kỳ bảng nào (Luật B2).
 */
export const migration001Initial: MigrationDefinition = {
  version: 1,
  name: '001_initial_schema',
  sql: `
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL,
  last_opened   TEXT
);

CREATE TABLE conversations (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,
  content          TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE TABLE steps (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq               INTEGER NOT NULL,
  agent_id          TEXT NOT NULL,
  model             TEXT,
  status            TEXT NOT NULL,
  summary           TEXT,
  risk_level        TEXT,
  checkpoint_before TEXT,
  checkpoint_after  TEXT,
  started_at        TEXT,
  finished_at       TEXT
);

CREATE TABLE step_files (
  id         TEXT PRIMARY KEY,
  step_id    TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  change     TEXT NOT NULL,
  risk_tags  TEXT
);

CREATE TABLE decisions (
  id          TEXT PRIMARY KEY,
  step_id     TEXT REFERENCES steps(id) ON DELETE SET NULL,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'approach',
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE project_map (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  description TEXT,
  files       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE user_edits (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  edited_at    TEXT NOT NULL
);

CREATE TABLE agent_sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  model       TEXT,
  external_id TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE models (
  agent_id    TEXT NOT NULL,
  model_id    TEXT NOT NULL,
  label       TEXT NOT NULL,
  tier        TEXT NOT NULL,
  available   INTEGER NOT NULL DEFAULT 1,
  detected_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, model_id)
);

CREATE TABLE quota_snapshots (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  model       TEXT,
  plan        TEXT,
  scope       TEXT NOT NULL,
  windows     TEXT NOT NULL,
  status      TEXT NOT NULL,
  source      TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE TABLE plugins (
  id                  TEXT PRIMARY KEY,
  version             TEXT NOT NULL,
  kind                TEXT NOT NULL,
  enabled             INTEGER NOT NULL DEFAULT 1,
  granted_permissions TEXT NOT NULL,
  installed_at        TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
};
