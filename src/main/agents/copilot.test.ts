import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migration001Initial } from '../db/migrations/001-initial';
import { CopilotAdapter, CopilotSessionInstance } from './copilot';
import { ModelTierService } from './models';
import { AgentSessionRepository } from './session-repo';
import type { AgentEvent } from './types';

describe('CopilotAdapter', () => {
  let db: Database.Database;
  let tempDir: string;
  let modelsService: ModelTierService;
  let sessionRepo: AgentSessionRepository;

  beforeEach(() => {
    tempDir = path.resolve(
      process.cwd(),
      'spikes',
      '.tmp',
      `copilot-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });
    db = new Database(':memory:');
    db.exec(migration001Initial.sql);

    modelsService = new ModelTierService({
      db,
      userDataDir: tempDir,
    });
    sessionRepo = new AgentSessionRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detect() trả về not_installed khi binary không tồn tại hoặc lỗi', async () => {
    const adapter = new CopilotAdapter(
      modelsService,
      sessionRepo,
      async () => ({ stdout: '', stderr: 'command not found', code: 127 }),
    );

    const result = await adapter.detect();
    expect(result.installed).toBe(false);
    expect(result.loggedIn).toBe(false);
    expect(result.status).toBe('not_installed');
    expect(result.agentId).toBe('copilot');
    expect(result.displayName).toBe('Copilot CLI');
    expect(result.logoLetter).toBe('P');
  });

  it('detect() trả về ready khi binary trả về version và auth status thành công', async () => {
    const adapter = new CopilotAdapter(
      modelsService,
      sessionRepo,
      async (_cmd, args) => {
        if (args[0] === '--version') {
          return { stdout: 'gh version 2.60.0 (2024-10-15)', stderr: '', code: 0 };
        }
        if (args[0] === 'auth' && args[1] === 'status') {
          return {
            stdout: 'github.com\n  ✓ Logged in to github.com as user (keyring)\n',
            stderr: '',
            code: 0,
          };
        }
        return { stdout: '', stderr: '', code: 0 };
      },
    );

    const result = await adapter.detect();
    expect(result.installed).toBe(true);
    expect(result.version).toBe('2.60.0');
    expect(result.loggedIn).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.modelsCount).toBeGreaterThan(0);
  });

  it('listModels() gán tier chính xác cho các model của Copilot', async () => {
    const adapter = new CopilotAdapter(modelsService, sessionRepo);
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);

    const sonnet = models.find((m) => m.id.includes('sonnet'));
    expect(sonnet?.tier).toBe('strong');

    const gpt4o = models.find((m) => m.id.includes('gpt-4o'));
    expect(gpt4o?.tier).toBe('balanced');

    const mini = models.find((m) => m.id.includes('mini'));
    expect(mini?.tier).toBe('fast');
  });

  it('startSession() và send() xử lý các dòng NDJSON', async () => {
    const adapter = new CopilotAdapter(modelsService, sessionRepo);
    const session = await adapter.startSession({
      cwd: tempDir,
      model: 'claude-3.5-sonnet',
    });

    const events: AgentEvent[] = [];
    const mockLines = [
      JSON.stringify({
        type: 'init',
        session_id: 'copilot-session-123',
      }),
      JSON.stringify({
        type: 'message',
        content: 'Copilot explanation chunk',
      }),
      JSON.stringify({
        type: 'result',
        stats: { input_tokens: 150, output_tokens: 75 },
      }),
    ];

    await (session as CopilotSessionInstance).send('test prompt', (e) => events.push(e), mockLines);

    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ type: 'message', text: 'Copilot explanation chunk' });
    expect(events[1]).toEqual({
      type: 'done',
      externalSessionId: 'copilot-session-123',
      usage: { inputTokens: 150, outputTokens: 75 },
    });
    expect(session.getExternalSessionId()).toBe('copilot-session-123');
  });
});
