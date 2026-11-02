import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migration001Initial } from '../db/migrations/001-initial';
import { ModelTierService } from './models';
import { AgentSessionRepository } from './session-repo';

describe('ModelTierService & AgentSessionRepository (Luật P10, ADR-019)', () => {
  let db: Database.Database;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.resolve(
      process.cwd(),
      'spikes',
      '.tmp',
      `models-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });
    db = new Database(':memory:');
    db.exec(migration001Initial.sql);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('tải danh mục mặc định và ánh xạ bậc theo cấu hình', () => {
    const service = new ModelTierService({
      db,
      userDataDir: tempDir,
    });

    const agentIds = service.getKnownAgentIds();
    expect(agentIds.length).toBeGreaterThanOrEqual(3);

    const models = service.listModels();
    expect(models.length).toBeGreaterThan(0);

    const firstModel = models[0];
    expect(firstModel).toBeDefined();
    expect(['strong', 'balanced', 'fast']).toContain(firstModel?.tier);
    expect(firstModel?.tierSource).toBe('default');
  });

  it('xếp model lạ vào bậc "unknown" (Chưa xếp bậc) với tierSource="unmapped"', () => {
    const service = new ModelTierService({
      db,
      userDataDir: tempDir,
    });

    const unknownModel = service.resolveModelInfo('codex', {
      id: 'brand-new-experimental-v9',
      label: 'GPT Experimental',
    });

    expect(unknownModel.tier).toBe('unknown');
    expect(unknownModel.tierSource).toBe('unmapped');
  });

  it('lưu ghi đè bậc của người dùng và đồng bộ vào SQLite và file JSON', () => {
    const service = new ModelTierService({
      db,
      userDataDir: tempDir,
    });

    // Người dùng đổi bậc
    const updated = service.setModelTier('codex', 'brand-new-experimental-v9', 'strong');
    expect(updated.tier).toBe('strong');
    expect(updated.tierSource).toBe('user');

    // Kiểm tra trong SQLite
    const row = db
      .prepare('SELECT tier FROM models WHERE agent_id = ? AND model_id = ?')
      .get('codex', 'brand-new-experimental-v9') as { tier: string } | undefined;
    expect(row?.tier).toBe('strong');

    // Kiểm tra khởi tạo instance mới vẫn nhận ghi đè từ file JSON trong userDataDir
    const service2 = new ModelTierService({
      db,
      userDataDir: tempDir,
    });
    const info = service2.resolveModelInfo('codex', {
      id: 'brand-new-experimental-v9',
    });
    expect(info.tier).toBe('strong');
    expect(info.tierSource).toBe('user');
  });

  it('loại bỏ các model cũ không còn trong discoveredModels khi đồng bộ', () => {
    const service = new ModelTierService({
      db,
      userDataDir: tempDir,
    });

    // 1. Giả lập DB có 2 model cũ
    db.prepare(`
      INSERT INTO models (agent_id, model_id, label, tier, available, detected_at)
      VALUES 
        ('codex', 'old-obsolete-model', 'Old Model', 'balanced', 1, datetime('now')),
        ('codex', 'gpt-6.1-sol', 'GPT-6.1 Sol', 'balanced', 1, datetime('now'))
    `).run();

    // 2. Đồng bộ danh sách mới chỉ gồm gpt-6-astra và gpt-6.1-sol
    const synced = service.syncAgentModels('codex', [
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
    ]);

    expect(synced.map((m) => m.id)).toEqual(['gpt-6-astra', 'gpt-6.1-sol']);

    // Kiểm tra trong DB: old-obsolete-model đã bị xoá
    const remaining = service.listModels('codex');
    expect(remaining).toHaveLength(2);
    expect(remaining.map((m) => m.id)).toEqual(expect.arrayContaining(['gpt-6-astra', 'gpt-6.1-sol']));
    expect(remaining.find((m) => m.id === 'old-obsolete-model')).toBeUndefined();
  });

  it('tự động thanh trừng các model giả gpt-5-codex và codex-mini-latest khi khởi tạo catalog', () => {
    // Giả lập DB cũ chứa 2 model giả
    db.prepare(`
      INSERT INTO models (agent_id, model_id, label, tier, available, detected_at)
      VALUES 
        ('codex', 'gpt-5-codex', 'GPT-5 Codex', 'strong', 1, datetime('now')),
        ('codex', 'codex-mini-latest', 'Codex Mini', 'fast', 1, datetime('now'))
    `).run();

    const service = new ModelTierService({
      db,
      userDataDir: tempDir,
    });

    const codexModels = service.listModels('codex');
    expect(codexModels.find((m) => m.id === 'gpt-5-codex')).toBeUndefined();
    expect(codexModels.find((m) => m.id === 'codex-mini-latest')).toBeUndefined();
    // Đã được seed lại các model thực tế từ catalog
    expect(codexModels.some((m) => m.id === 'gpt-6-astra')).toBe(true);
    expect(codexModels.some((m) => m.id === 'gpt-6.1-sol')).toBe(true);
  });

  it('lưu trữ và tìm lại phiên agent_sessions theo cwd hoặc projectId', () => {
    const sessionRepo = new AgentSessionRepository(db);
    const fakeCwd = path.join(tempDir, 'sample-project');
    fs.mkdirSync(fakeCwd, { recursive: true });

    const created = sessionRepo.createSession({
      cwd: fakeCwd,
      agentId: 'claude',
      model: 'claude-sonnet-4-5',
      externalId: 'sess_ext_123',
    });

    expect(created.id).toMatch(/^asess_/);
    expect(created.externalId).toBe('sess_ext_123');

    const fetched = sessionRepo.getById(created.id);
    expect(fetched?.model).toBe('claude-sonnet-4-5');
    expect(fetched?.agentId).toBe('claude');

    // Tìm theo cwd
    const latest = sessionRepo.getLatestForProjectAndAgent(fakeCwd, 'claude');
    expect(latest?.id).toBe(created.id);

    // Cập nhật externalId
    sessionRepo.updateExternalId(created.id, 'sess_ext_updated_456');
    const updated = sessionRepo.getById(created.id);
    expect(updated?.externalId).toBe('sess_ext_updated_456');
  });
});
