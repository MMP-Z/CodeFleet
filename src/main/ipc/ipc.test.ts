import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  IPC_CHANNELS,
  type BackupNowOutput,
  type DataInfoOutput,
  type GitCheckOutput,
  type IpcResult,
  type OpenDataDirOutput,
} from '@shared/ipc';
import type { DetectResult, ModelInfo } from '@shared/agents';
import type { AppSettingsMap } from '@shared/settings';
import { DatabaseService } from '../db/database';
import { createLogger } from '../logger/logger';
import { registerPhase1IpcHandlers } from './handlers';
import type { IpcRegistrar } from './router';
import { checkSystemGit } from './system-git';

class InMemoryIpcBus implements IpcRegistrar {
  private readonly handlers = new Map<
    string,
    (_event: unknown, rawInput: unknown) => Promise<unknown>
  >();

  public handle(
    channel: string,
    listener: (_event: unknown, rawInput: unknown) => Promise<unknown>,
  ): void {
    this.handlers.set(channel, listener);
  }

  public async invoke<T>(channel: string, rawInput?: unknown): Promise<IpcResult<T>> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel ${channel}`);
    }
    return (await handler({}, rawInput)) as IpcResult<T>;
  }
}

describe('Phase 1 Typed IPC + Zod Validation (Luật P3, B2)', () => {
  const tempDirs: string[] = [];
  const openServices: DatabaseService[] = [];

  afterEach(() => {
    for (const svc of openServices.splice(0)) {
      svc.close();
    }
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function setupTestBus(openFolderMock: (dir: string) => Promise<string> = async () => '') {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-ipc-test-'));
    tempDirs.push(userDataDir);

    const logger = createLogger({ logDir: path.join(userDataDir, 'logs'), scope: 'test' });
    const dbService = new DatabaseService({ userDataDir, logger });
    dbService.openAndMigrate();
    openServices.push(dbService);

    const bus = new InMemoryIpcBus();
    registerPhase1IpcHandlers(bus, {
      userDataDir,
      dbService,
      logger,
      openFolderInOs: openFolderMock,
    });

    return { bus, userDataDir, dbService };
  }

  it('performs full settings.getAll -> settings.set -> settings.get round-trip', async () => {
    const { bus } = setupTestBus();

    const initial = await bus.invoke<AppSettingsMap>(IPC_CHANNELS.SETTINGS_GET_ALL);
    expect(initial).toEqual({
      ok: true,
      data: {
        'ui.locale': 'vi',
        'ui.codeLevel': 'summary',
        'ui.showJargon': false,
        'ui.autoPreview': true,
        'agents.enabled': {},
        'onboarding.completed': false,
      },
    });

    const updated = await bus.invoke<AppSettingsMap>(IPC_CHANNELS.SETTINGS_SET, {
      key: 'ui.codeLevel',
      value: 'diff',
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data['ui.codeLevel']).toBe('diff');
    }

    const single = await bus.invoke<string>(IPC_CHANNELS.SETTINGS_GET, {
      key: 'ui.codeLevel',
    });
    expect(single).toEqual({ ok: true, data: 'diff' });
  });

  it('rejects malformed or unauthorized IPC payloads via Zod with VALIDATION_ERROR', async () => {
    const { bus } = setupTestBus();

    // Sai kiểu giá trị cho ui.showJargon
    const badType = await bus.invoke(IPC_CHANNELS.SETTINGS_SET, {
      key: 'ui.showJargon',
      value: 'not-a-boolean',
    });
    expect(badType.ok).toBe(false);
    if (!badType.ok) {
      expect(badType.error.code).toBe('VALIDATION_ERROR');
    }

    // Cố truyền khoá token ngoài hợp đồng (Luật B2/P3)
    const secretAttempt = await bus.invoke(IPC_CHANNELS.SETTINGS_SET, {
      key: 'agent.access_token',
      value: 'sk-ant-secret123456789',
    });
    expect(secretAttempt.ok).toBe(false);
    if (!secretAttempt.ok) {
      expect(secretAttempt.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('handles system.getDataInfo, system.openDataDir, system.backupNow, and system.checkGit', async () => {
    let openedPath = '';
    const { bus, userDataDir } = setupTestBus(async (dir) => {
      openedPath = dir;
      return '';
    });

    const info = await bus.invoke<DataInfoOutput>(IPC_CHANNELS.SYSTEM_GET_DATA_INFO);
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.data.userDataDir).toBe(userDataDir);
      expect(info.data.dbPath).toContain('codefleet.sqlite');
    }

    const openRes = await bus.invoke<OpenDataDirOutput>(IPC_CHANNELS.SYSTEM_OPEN_DATA_DIR);
    expect(openRes).toEqual({ ok: true, data: { opened: true, error: null } });
    expect(openedPath).toBe(userDataDir);

    const backupRes = await bus.invoke<BackupNowOutput>(IPC_CHANNELS.SYSTEM_BACKUP_NOW);
    expect(backupRes.ok).toBe(true);
    if (backupRes.ok) {
      expect(fs.existsSync(backupRes.data.backupPath)).toBe(true);
      expect(backupRes.data.sizeBytes).toBeGreaterThan(0);
    }

    const gitRes = await bus.invoke<GitCheckOutput>(IPC_CHANNELS.SYSTEM_CHECK_GIT);
    expect(gitRes.ok).toBe(true);

    // Kiểm tra nhánh thiếu git không ném ngoại lệ
    const missingGit = await checkSystemGit('definitely-non-existent-git-binary-xyz');
    expect(missingGit).toEqual({ available: false, version: null });
  });

  it('handles Phase 2 IPC channels: agents.detectAll, agents.openLogin, models.list, models.setTier', async () => {
    const { bus } = setupTestBus();

    // 1. agents.detectAll
    const detectRes = await bus.invoke<DetectResult[]>(IPC_CHANNELS.AGENTS_DETECT_ALL);
    expect(detectRes.ok).toBe(true);
    if (detectRes.ok) {
      expect(detectRes.data.length).toBeGreaterThanOrEqual(3);
    }

    // 2. models.list
    const modelsRes = await bus.invoke<ModelInfo[]>(IPC_CHANNELS.MODELS_LIST, {});
    expect(modelsRes.ok).toBe(true);
    if (modelsRes.ok) {
      expect(modelsRes.data.length).toBeGreaterThan(0);
      const first = modelsRes.data[0];
      expect(first).toBeDefined();
      expect(['strong', 'balanced', 'fast', 'unknown']).toContain(first?.tier);
    }

    // 3. models.setTier
    const setTierRes = await bus.invoke<ModelInfo>(IPC_CHANNELS.MODELS_SET_TIER, {
      agentId: 'codex',
      modelId: 'gpt-5-codex',
      tier: 'strong',
    });
    expect(setTierRes.ok).toBe(true);
    if (setTierRes.ok) {
      expect(setTierRes.data.tier).toBe('strong');
      expect(setTierRes.data.tierSource).toBe('user');
    }

    // 4. models.setTier với tier sai -> VALIDATION_ERROR
    const badTierRes = await bus.invoke(IPC_CHANNELS.MODELS_SET_TIER, {
      agentId: 'codex',
      modelId: 'gpt-5-codex',
      tier: 'super-genius-unsupported',
    });
    expect(badTierRes.ok).toBe(false);
    if (!badTierRes.ok) {
      expect(badTierRes.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
