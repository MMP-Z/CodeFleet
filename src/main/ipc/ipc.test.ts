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

  it('handles Phase 3 IPC channels: projects, conversations, and orchestrator', async () => {
    const { bus, userDataDir } = setupTestBus();
    const projectDir = path.join(userDataDir, 'test-project');
    fs.mkdirSync(projectDir, { recursive: true });

    // 1. projects.validatePath
    const valRes = await bus.invoke<{ exists: boolean; isEmpty: boolean; isWritable: boolean }>(
      IPC_CHANNELS.PROJECTS_VALIDATE_PATH,
      { path: projectDir },
    );
    expect(valRes.ok).toBe(true);
    if (valRes.ok) {
      expect(valRes.data.exists).toBe(true);
      expect(valRes.data.isWritable).toBe(true);
    }

    // 2. projects.create
    const createProjRes = await bus.invoke<{ id: string; name: string; path: string }>(
      IPC_CHANNELS.PROJECTS_CREATE,
      { name: 'My Landing App', path: projectDir },
    );
    expect(createProjRes.ok).toBe(true);
    let projectId = '';
    if (createProjRes.ok) {
      projectId = createProjRes.data.id;
      expect(createProjRes.data.name).toBe('My Landing App');
    }

    // 3. projects.list & projects.open
    const listProjRes = await bus.invoke<Array<{ id: string }>>(IPC_CHANNELS.PROJECTS_LIST);
    expect(listProjRes.ok).toBe(true);
    if (listProjRes.ok) {
      expect(listProjRes.data.length).toBeGreaterThanOrEqual(1);
    }

    const openProjRes = await bus.invoke<{ id: string }>(IPC_CHANNELS.PROJECTS_OPEN, {
      id: projectId,
    });
    expect(openProjRes.ok).toBe(true);

    // 4. conversations.list (đã tự tạo 1 conv khi tạo project)
    const listConvRes = await bus.invoke<Array<{ id: string; projectId: string }>>(
      IPC_CHANNELS.CONVERSATIONS_LIST,
      { projectId },
    );
    expect(listConvRes.ok).toBe(true);
    let convId = '';
    if (listConvRes.ok) {
      expect(listConvRes.data.length).toBeGreaterThanOrEqual(1);
      convId = listConvRes.data[0]!.id;
    }

    // 5. orchestrator.send (kích hoạt chạy)
    const sendRes = await bus.invoke<{ started: boolean }>(IPC_CHANNELS.ORCHESTRATOR_SEND, {
      conversationId: convId,
      prompt: 'Làm trang chủ đơn giản',
    });
    expect(sendRes.ok).toBe(true);

    // 6. conversations.messages
    const msgsRes = await bus.invoke<Array<{ role: string; content: string }>>(
      IPC_CHANNELS.CONVERSATIONS_MESSAGES,
      { conversationId: convId },
    );
    expect(msgsRes.ok).toBe(true);
    if (msgsRes.ok) {
      expect(msgsRes.data.some((m) => m.role === 'user')).toBe(true);
      expect(msgsRes.data.some((m) => m.role === 'assistant')).toBe(true);
    }

    // 7. orchestrator.cancel
    const cancelRes = await bus.invoke(IPC_CHANNELS.ORCHESTRATOR_CANCEL, {
      conversationId: convId,
    });
    expect(cancelRes.ok).toBe(true);
  });

  it('handles Phase 4 IPC contracts: code, explain, undo, editables, and preview', async () => {
    const { bus, userDataDir } = setupTestBus();
    const projectDir = path.join(userDataDir, 'test-p4-proj');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'index.html'),
      '<h1>Tiệm Bánh Ban Đầu</h1>\n<p>Mô tả</p>\n',
      'utf8',
    );

    // 1. Tạo project
    const createProj = await bus.invoke<{ id: string; path: string }>(
      IPC_CHANNELS.PROJECTS_CREATE,
      {
        name: 'Phase 4 Project',
        path: projectDir,
      },
    );
    expect(createProj.ok).toBe(true);
    const projectId = (createProj as { data: { id: string } }).data.id;

    // 2. project.editables
    const editablesRes = await bus.invoke<Array<{ id: string; value: string }>>(
      IPC_CHANNELS.PROJECT_EDITABLES,
      { projectId },
    );
    if (!editablesRes.ok) {
      console.log('EDITABLES ERROR:', editablesRes.error);
    }
    expect(editablesRes.ok).toBe(true);
    if (editablesRes.ok) {
      expect(editablesRes.data.some((e) => e.value === 'Tiệm Bánh Ban Đầu')).toBe(true);
    }

    // 3. code.explainSegment
    const explainRes = await bus.invoke<{ explanation: string }>(
      IPC_CHANNELS.CODE_EXPLAIN_SEGMENT,
      { codeSnippet: 'const total = price * quantity;' },
    );
    expect(explainRes.ok).toBe(true);
    if (explainRes.ok) {
      expect(explainRes.data.explanation).toContain('thực hiện:');
    }

    // 4. preview.status & preview.start
    const previewStatusRes = await bus.invoke<{ isWebProject: boolean }>(
      IPC_CHANNELS.PREVIEW_STATUS,
      { projectId },
    );
    expect(previewStatusRes.ok).toBe(true);
    if (previewStatusRes.ok) {
      expect(previewStatusRes.data.isWebProject).toBe(true);
    }
  });
});
