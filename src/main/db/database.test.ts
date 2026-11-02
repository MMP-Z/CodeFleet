import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseService } from './database';
import { migration001Initial, type MigrationDefinition } from './migrations/001-initial';
import { SettingsRepository } from './settings-repo';

const EXPECTED_TABLES = [
  'projects',
  'conversations',
  'messages',
  'steps',
  'step_files',
  'decisions',
  'project_map',
  'user_edits',
  'agent_sessions',
  'models',
  'quota_snapshots',
  'plugins',
  'settings',
];

describe('DatabaseService & SettingsRepository (ADR-002, Luật P8, B2)', () => {
  const tempDirs: string[] = [];
  const activeServices: DatabaseService[] = [];

  afterEach(() => {
    for (const svc of activeServices.splice(0)) {
      try {
        svc.close();
      } catch {
        // ignore
      }
    }
    for (const dir of tempDirs.splice(0)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  function makeTempUserData(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-db-test-'));
    tempDirs.push(dir);
    return dir;
  }

  function createTrackedService(
    opts: ConstructorParameters<typeof DatabaseService>[0],
  ): DatabaseService {
    const svc = new DatabaseService(opts);
    activeServices.push(svc);
    return svc;
  }

  it('enables WAL mode, foreign keys, and creates all 13 Migration 001 tables', () => {
    const userDataDir = makeTempUserData();
    const service = createTrackedService({ userDataDir });
    const db = service.openAndMigrate();

    const journalMode = db.pragma('journal_mode', { simple: true });
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    expect(journalMode).toBe('wal');
    expect(foreignKeys).toBe(1);

    const rows = db
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    const tableNames = rows.map((r) => r.name);

    for (const expected of EXPECTED_TABLES) {
      expect(tableNames).toContain(expected);
    }

    // Kiểm tra khoá ngoại ON DELETE CASCADE
    db.prepare('INSERT INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
      'p1',
      'Tiệm Bánh Nhỏ',
      'D:/projects/tiem-banh',
      '2026-11-02T00:00:00Z',
    );
    db.prepare(
      'INSERT INTO conversations (id, project_id, title, created_at) VALUES (?, ?, ?, ?)',
    ).run('c1', 'p1', 'Tạo trang chủ', '2026-11-02T00:01:00Z');
    db.prepare('DELETE FROM projects WHERE id = ?').run('p1');

    const remainingConvs = db
      .prepare<[string], { id: string }>('SELECT id FROM conversations WHERE project_id = ?')
      .all('p1');
    expect(remainingConvs).toHaveLength(0);

    service.close();
  });

  it('creates an automatic pre-migration .sqlite.bak backup before applying new migrations (Luật P8)', () => {
    const userDataDir = makeTempUserData();

    // Lần mở 1: Migration 001 + dữ liệu người dùng
    const serviceV1 = createTrackedService({
      userDataDir,
    });
    const dbV1 = serviceV1.openAndMigrate();
    dbV1
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run('ui.codeLevel', JSON.stringify('diff'));
    serviceV1.close();

    // Lần mở 2: Nâng cấp có thêm Migration 002 giả lập
    const migration002Mock: MigrationDefinition = {
      version: 2,
      name: '002_add_index_test',
      sql: 'CREATE INDEX idx_steps_conv_test ON steps(conversation_id);',
    };

    const serviceV2 = createTrackedService({
      userDataDir,
      migrations: [migration001Initial, migration002Mock],
    });
    const dbV2 = serviceV2.openAndMigrate();

    const backups = fs.readdirSync(serviceV2.getBackupDir());
    expect(backups.some((f) => f.includes('pre-migration-v2') && f.endsWith('.sqlite.bak'))).toBe(
      true,
    );

    // Dữ liệu cũ vẫn nguyên vẹn sau nâng cấp
    const settingsRepo = new SettingsRepository(dbV2);
    expect(settingsRepo.get('ui.codeLevel')).toBe('diff');

    // Sao lưu thủ công "Sao lưu ngay"
    const manualBackup = serviceV2.backupNow('user');
    expect(fs.existsSync(manualBackup.backupPath)).toBe(true);
    expect(manualBackup.sizeBytes).toBeGreaterThan(0);

    serviceV2.close();
  });

  it('persists typed settings across restarts and rejects secret keys per Luật B2', () => {
    const userDataDir = makeTempUserData();
    const service = createTrackedService({ userDataDir });
    const db = service.openAndMigrate();
    const repo = new SettingsRepository(db);

    expect(repo.getAll()).toEqual({
      'ui.locale': 'vi',
      'ui.codeLevel': 'summary',
      'ui.showJargon': false,
      'ui.autoPreview': true,
      'agents.enabled': {},
      'onboarding.completed': false,
    });

    repo.set('ui.showJargon', true);
    repo.set('ui.codeLevel', 'full');
    service.close();

    // Mở lại lần mới để kiểm chứng bền vững sau khởi động lại
    const serviceReopened = createTrackedService({ userDataDir });
    const repoReopened = new SettingsRepository(serviceReopened.openAndMigrate());
    expect(repoReopened.get('ui.showJargon')).toBe(true);
    expect(repoReopened.get('ui.codeLevel')).toBe('full');

    // Luật B2: cấm lưu token/khoá
    expect(() => repoReopened.assertNotSecretKey('agent.oauth_token')).toThrow(/Luật B2/);
    expect(() => repoReopened.assertNotSecretKey('provider_api_key')).toThrow(/Luật B2/);

    serviceReopened.close();
  });
});
