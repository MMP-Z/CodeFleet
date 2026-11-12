import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migration001Initial } from '../db/migrations/001-initial';
import { AgyAdapter, AgySessionInstance } from './agy';
import { ModelTierService } from './models';
import { AgentSessionRepository } from './session-repo';
import type { AgentEvent } from './types';

describe('AgyAdapter', () => {
  let db: Database.Database;
  let tempDir: string;
  let modelsService: ModelTierService;
  let sessionRepo: AgentSessionRepository;

  beforeEach(() => {
    tempDir = path.resolve(
      process.cwd(),
      'spikes',
      '.tmp',
      `agy-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      // bỏ qua lỗi dọn dẹp
    }
  });

  it('detect() trả về not_installed khi binary không tồn tại hoặc lỗi', async () => {
    const adapter = new AgyAdapter(modelsService, sessionRepo, async () => ({
      stdout: '',
      stderr: 'command not found',
      code: 127,
    }));

    const result = await adapter.detect();
    expect(result.installed).toBe(false);
    expect(result.loggedIn).toBe(false);
    expect(result.status).toBe('not_installed');
    expect(result.agentId).toBe('agy');
    expect(result.displayName).toBe('Antigravity CLI');
    expect(result.logoLetter).toBe('A');
  });

  it('detect() trả về ready khi binary trả về version và models thành công', async () => {
    const adapter = new AgyAdapter(modelsService, sessionRepo, async (_cmd, args) => {
      if (args[0] === '--version') {
        return { stdout: '1.4.11', stderr: '', code: 0 };
      }
      if (args[0] === 'models') {
        return {
          stdout:
            'Fetching available models...\ngemini-4-argon-medium\tGemini 4 Argon (Medium)\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)\n',
          stderr: '',
          code: 0,
        };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    const result = await adapter.detect();
    expect(result.installed).toBe(true);
    expect(result.version).toBe('1.4.11');
    expect(result.loggedIn).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.modelsCount).toBe(2);
  });

  it('listModels() phân tích chính xác tên model và gán tier', async () => {
    const adapter = new AgyAdapter(modelsService, sessionRepo);
    const rawOutput = `Fetching available models...
gemini-4-argon-medium\tGemini 4 Argon (Medium)
claude-sonnet-5-5-high\tClaude Sonnet 5.5 (High)
gemini-3.8-flash-low\tGemini 3.8 Flash (Low)
`;
    const models = await adapter.listModels(rawOutput);
    expect(models.length).toBe(3);

    const argon = models.find((m) => m.id === 'gemini-4-argon-medium');
    expect(argon?.tier).toBe('strong');

    const sonnet = models.find((m) => m.id === 'claude-sonnet-5-5-high');
    expect(sonnet?.tier).toBe('balanced');

    const flash = models.find((m) => m.id === 'gemini-3.8-flash-low');
    expect(flash?.tier).toBe('fast');
  });

  it('startSession() và send() xử lý các dòng NDJSON từ stream-json', async () => {
    const adapter = new AgyAdapter(modelsService, sessionRepo);
    const session = await adapter.startSession({
      cwd: tempDir,
      model: 'gemini-4-argon-medium',
    });

    const events: AgentEvent[] = [];
    const mockLines = [
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 1,
          state: 'ACTIVE',
          text_delta: 'Hello world! ',
        },
      }),
      JSON.stringify({
        event: 'step_update',
        step_update: {
          step_index: 1,
          state: 'DONE',
          text_delta: 'CodeFleet integration works.',
        },
      }),
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-agy-123',
          status: 'SUCCESS',
          response: 'Full response',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      }),
    ];

    await (session as AgySessionInstance).send('test prompt', (e) => events.push(e), mockLines);

    expect(events.length).toBe(3);
    expect(events[0]).toEqual({ type: 'message', text: 'Hello world! ' });
    expect(events[1]).toEqual({ type: 'message', text: 'CodeFleet integration works.' });
    expect(events[2]).toEqual({
      type: 'done',
      externalSessionId: 'conv-agy-123',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    expect(session.getExternalSessionId()).toBe('conv-agy-123');
  });
});
