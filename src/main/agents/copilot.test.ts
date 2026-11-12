import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migration001Initial } from '../db/migrations/001-initial';
import * as binaryResolver from './binary-resolver';
import * as copilotAuth from './copilot-auth';
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
    vi.restoreAllMocks();
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
    const adapter = new CopilotAdapter(modelsService, sessionRepo, async () => ({
      stdout: '',
      stderr: 'command not found',
      code: 127,
    }));

    const result = await adapter.detect();
    expect(result.installed).toBe(false);
    expect(result.loggedIn).toBe(false);
    expect(result.status).toBe('not_installed');
    expect(result.agentId).toBe('copilot');
    expect(result.displayName).toBe('Copilot CLI');
    expect(result.logoLetter).toBe('P');
  });

  it.each([
    [true, 'ready'],
    [false, 'not_logged_in'],
    [null, 'error'],
  ] as const)('detect() chuyển trạng thái Copilot %s thành %s', async (authenticated, status) => {
    vi.spyOn(binaryResolver, 'resolveAgentBinary').mockReturnValue('copilot');
    vi.spyOn(copilotAuth, 'getCopilotAuthStatus').mockResolvedValue(authenticated);
    const adapter = new CopilotAdapter(modelsService, sessionRepo, async (_cmd, args) => {
      expect(args).toEqual(['--version']);
      return { stdout: 'GitHub Copilot CLI 1.0.109', stderr: '', code: 0 };
    });

    const result = await adapter.detect();
    expect(result.installed).toBe(true);
    expect(result.version).toBe('1.0.109');
    expect(result.loggedIn).toBe(authenticated === true);
    expect(result.status).toBe(status);
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

  it('streams Copilot JSONL once and retains the session ID for follow-up prompts', async () => {
    const adapter = new CopilotAdapter(modelsService, sessionRepo);
    const session = (await adapter.startSession({
      cwd: tempDir,
      model: 'auto',
    })) as CopilotSessionInstance;
    const events: AgentEvent[] = [];
    const streamed = new Set<string>();
    const collect = (event: AgentEvent): void => {
      events.push(event);
    };
    session.processNdjsonLines(
      [
        '{"type":"session.start","data":{"sessionId":"new-session"}}',
        '{"type":"assistant.message_delta","data":{"messageId":"m1","deltaContent":"Xin "}}',
      ],
      collect,
      streamed,
    );
    session.processNdjsonLines(
      [
        '{"type":"assistant.message_delta","data":{"messageId":"m1","deltaContent":"chào"}}',
        '{"type":"assistant.message","data":{"messageId":"m1","content":"Xin chào"}}',
        '{"type":"result","sessionId":"new-session","exitCode":0}',
      ],
      collect,
      streamed,
    );
    expect(events).toEqual([
      { type: 'message', text: 'Xin ' },
      { type: 'message', text: 'chào' },
      { type: 'done', externalSessionId: 'new-session', usage: undefined },
    ]);
    expect(session.getExternalSessionId()).toBe('new-session');
  });
});
