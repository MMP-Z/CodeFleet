const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const Database = require('better-sqlite3');

const MIGRATION_001_SQL = `
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
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq              INTEGER NOT NULL,
  agent_id         TEXT NOT NULL,
  model            TEXT,
  status           TEXT NOT NULL,
  summary          TEXT,
  risk_level       TEXT,
  checkpoint_before TEXT,
  checkpoint_after  TEXT,
  started_at       TEXT,
  finished_at      TEXT
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
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  edited_at   TEXT NOT NULL
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
  id          TEXT PRIMARY KEY,
  version     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  granted_permissions TEXT NOT NULL,
  installed_at TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

app.whenReady().then(() => {
  try {
    const tmpDir = path.join(__dirname, '.tmp', 'sqlite-electron');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const dbPath = path.join(tmpDir, 'codefleet.db');

    // Create initial DB file so we can verify pre-migration backup (Luật P8)
    const bootstrapDb = new Database(dbPath);
    bootstrapDb.pragma('journal_mode = WAL');
    bootstrapDb.exec('CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);');
    bootstrapDb.close();

    // Backup before running migration 001 (Luật P8)
    const backupPath = `${dbPath}.pre-001.bak`;
    fs.copyFileSync(dbPath, backupPath);
    assert.equal(fs.existsSync(backupPath), true, 'Pre-migration backup file must exist');

    const db = new Database(dbPath);
    const mode = db.pragma('journal_mode = WAL', { simple: true });
    db.pragma('foreign_keys = ON');
    assert.equal(mode, 'wal', 'SQLite journal_mode must be wal');

    const runMigration = db.transaction(() => {
      db.exec(MIGRATION_001_SQL);
      db.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
    });
    runMigration();

    // Insert & read Vietnamese UTF-8 data
    const now = new Date().toISOString();
    db.prepare('INSERT INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
      'p1',
      'Tiệm Bánh Nhỏ',
      'D:/Users/demo/Documents/tiem-banh',
      now,
    );
    db.prepare('INSERT INTO conversations (id, project_id, title, created_at) VALUES (?, ?, ?, ?)').run(
      'c1',
      'p1',
      'Làm trang chủ và giỏ hàng',
      now,
    );
    db.prepare(
      'INSERT INTO steps (id, conversation_id, seq, agent_id, model, status, summary) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('s1', 'c1', 1, 'claude', 'sonnet', 'waiting_permission', 'Đang chờ bạn cho phép cài thư viện');
    db.prepare('INSERT INTO decisions (id, step_id, project_id, kind, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'd1',
      's1',
      'p1',
      'switch',
      'Đổi sang model mạnh cho bước nhạy cảm',
      now,
    );

    const row = db.prepare('SELECT p.name, s.status, d.kind, d.text FROM projects p JOIN conversations c ON c.project_id = p.id JOIN steps s ON s.conversation_id = c.id JOIN decisions d ON d.step_id = s.id WHERE p.id = ?').get('p1');
    assert.equal(row.name, 'Tiệm Bánh Nhỏ');
    assert.equal(row.status, 'waiting_permission');
    assert.equal(row.kind, 'switch');

    // Verify cascade delete
    db.prepare('DELETE FROM projects WHERE id = ?').run('p1');
    const stepCount = db.prepare('SELECT COUNT(*) AS cnt FROM steps').get().cnt;
    assert.equal(stepCount, 0, 'ON DELETE CASCADE must remove child steps');

    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log(
      JSON.stringify({
        ok: true,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome,
        abiModuleVersion: process.versions.modules,
        journalMode: mode,
        tablesVerified: 13,
      }),
    );
    app.exit(0);
  } catch (err) {
    console.error('[ELECTRON SQLITE ERROR]', err);
    app.exit(1);
  }
});
