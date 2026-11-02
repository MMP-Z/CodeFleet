import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseService } from './database';
import { migration001Initial } from './migrations/001-initial';
import type { MigrationDefinition } from './migrations';
import { ConversationRepository } from './conversation-repo';
import { PluginRepository } from './plugin-repo';
import { ProjectRepository } from './project-repo';
import { QuotaRepository } from './quota-repo';
import { SettingsRepository } from './settings-repo';

describe('Phase 7: Clean Install & Version Upgrade Data Retention (Tiêu chí thoát Phase 7)', () => {
  const tempDirs: string[] = [];

  function makeTempUserData(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-phase7-retention-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const d of tempDirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        // Ignored on file lock
      }
    }
  });

  it('performs clean install on a fresh machine with zero previous data', () => {
    const userDataDir = makeTempUserData();
    const service = new DatabaseService({ userDataDir, migrations: [migration001Initial] });
    const db = service.openAndMigrate();

    // Xác nhận toàn bộ 13 bảng khởi tạo tồn tại
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('_schema_migrations');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('steps');
    expect(tableNames).toContain('step_files');
    expect(tableNames).toContain('decisions');
    expect(tableNames).toContain('agent_sessions');
    expect(tableNames).toContain('plugins');
    expect(tableNames).toContain('quota_snapshots');

    const settingsRepo = new SettingsRepository(db);
    expect(settingsRepo.get('onboarding.completed')).toBe(false);
    expect(settingsRepo.get('update.channel')).toBe('stable');
    expect(settingsRepo.get('update.autoDownload')).toBe(true);

    service.close();
  });

  it('preserves 100% of user data, settings, plugins, and conversations when upgrading between versions', () => {
    const userDataDir = makeTempUserData();

    // === GIAI ĐOẠN 1: ỨNG DỤNG Ở BẢN V0.1.0 ===
    const v1Service = new DatabaseService({ userDataDir, migrations: [migration001Initial] });
    const v1Db = v1Service.openAndMigrate();

    const v1Settings = new SettingsRepository(v1Db);
    v1Settings.set('ui.codeLevel', 'full');
    v1Settings.set('update.channel', 'beta');
    v1Settings.set('onboarding.completed', true);

    const v1Projects = new ProjectRepository(v1Db);
    const createdProject = v1Projects.create({
      id: 'proj_cake_shop',
      name: 'Tiệm Bánh Nhỏ',
      path: 'D:/Projects/tiem-banh',
    });
    expect(createdProject.id).toBe('proj_cake_shop');

    const v1Convs = new ConversationRepository(v1Db);
    const conv = v1Convs.create('proj_cake_shop', 'Hội thoại tạo trang đặt bánh');
    const createdSteps = v1Convs.createSteps(conv.id, [
      {
        seq: 1,
        agentId: 'claude',
        model: 'claude-3-7-sonnet',
        summary: 'Thiết kế form đặt bánh',
        status: 'done',
        riskLevel: 'low',
      },
    ]);
    const stepId = createdSteps[0]!.id;

    const v1Plugins = new PluginRepository(v1Db);
    v1Plugins.save({
      id: 'custom.audit-tool',
      version: '1.0.0',
      kind: 'skill-pack',
      enabled: true,
      grantedPermissions: ['project:read'],
    });

    const v1Quota = new QuotaRepository(v1Db);
    v1Quota.save({
      id: 'snap_01',
      agentId: 'claude',
      model: 'claude-3-7-sonnet',
      scope: 'model',
      plan: 'pro',
      windows: [{ label: '5h', usedPercent: 42, resetsAt: null }],
      status: 'ok',
      source: 'official',
      capturedAt: new Date().toISOString(),
    });

    v1Service.close();

    // === GIAI ĐOẠN 2: NÂNG CẤP LÊN BẢN V0.2.0 (CÓ MIGRATION 002) ===
    const migration002Mock: MigrationDefinition = {
      version: 2,
      name: '002_add_app_stats_and_index',
      sql: `
        CREATE TABLE IF NOT EXISTS app_stats (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_steps_agent ON steps(agent_id);
      `,
    };

    const v2Service = new DatabaseService({
      userDataDir,
      migrations: [migration001Initial, migration002Mock],
    });
    const v2Db = v2Service.openAndMigrate();

    // 1. Kiểm tra bản sao lưu tự động .sqlite.bak trước khi chạy migration (Luật P8)
    const backupFiles = fs.readdirSync(v2Service.getBackupDir());
    const preMigrationBackup = backupFiles.find(
      (f) => f.includes('pre-migration-v2') && f.endsWith('.sqlite.bak'),
    );
    expect(preMigrationBackup).toBeDefined();

    // 2. Kiểm tra bảng mới từ migration 002 đã được tạo
    const v2Tables = v2Db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'app_stats'")
      .all();
    expect(v2Tables.length).toBe(1);

    // 3. Kiểm tra toàn vẹn 100% dữ liệu cũ (Zero Data Loss)
    const v2Settings = new SettingsRepository(v2Db);
    expect(v2Settings.get('ui.codeLevel')).toBe('full');
    expect(v2Settings.get('update.channel')).toBe('beta');
    expect(v2Settings.get('onboarding.completed')).toBe(true);

    const v2Projects = new ProjectRepository(v2Db);
    const retainedProject = v2Projects.getById('proj_cake_shop');
    expect(retainedProject).not.toBeNull();
    expect(retainedProject?.name).toBe('Tiệm Bánh Nhỏ');
    expect(retainedProject?.path).toBe('D:/Projects/tiem-banh');

    const v2Convs = new ConversationRepository(v2Db);
    const retainedStep = v2Convs.getStepById(stepId);
    expect(retainedStep).not.toBeNull();
    expect(retainedStep?.summary).toBe('Thiết kế form đặt bánh');
    expect(retainedStep?.status).toBe('done');

    const v2Plugins = new PluginRepository(v2Db);
    const retainedPlugin = v2Plugins.get('custom.audit-tool');
    expect(retainedPlugin).not.toBeNull();
    expect(retainedPlugin?.id).toBe('custom.audit-tool');
    expect(retainedPlugin?.enabled).toBe(true);

    const v2Quota = new QuotaRepository(v2Db);
    const retainedSnapshots = v2Quota.getLatestAll();
    expect(retainedSnapshots.some((s) => s.agentId === 'claude')).toBe(true);

    v2Service.close();
  });
});
