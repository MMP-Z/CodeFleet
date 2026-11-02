import type { MigrationDefinition } from './001-initial';

/**
 * Migration 002 — Bổ sung cột diff cho step_files và bảng checkpoints cho Phase 4.
 * Tuân thủ Luật P8 (migration số tăng dần, có sao lưu tự động).
 */
export const migration002Phase4: MigrationDefinition = {
  version: 2,
  name: '002_phase4_diff_and_checkpoints',
  sql: `
ALTER TABLE step_files ADD COLUMN diff_summary TEXT;
ALTER TABLE step_files ADD COLUMN full_diff TEXT;

CREATE TABLE IF NOT EXISTS checkpoints (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id     TEXT REFERENCES steps(id) ON DELETE SET NULL,
  git_hash    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_step_files_step_id ON step_files(step_id);
CREATE INDEX IF NOT EXISTS idx_user_edits_project_id ON user_edits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_map_project_id ON project_map(project_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_project_id ON checkpoints(project_id);
`,
};
