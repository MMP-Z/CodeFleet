import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migration001Initial } from '../db/migrations/001-initial';
import { PathViolationError } from '../security/path-guard';
import { ClaudeAdapter, type CommandRunner } from './claude';
import { CodexAdapter } from './codex';
import { AgentRegistry } from './detect';
import { GeminiAdapter } from './gemini';
import { ModelTierService } from './models';
import { AgentSessionRepository } from './session-repo';
import type { AgentEvent } from './types';

interface MockableSession {
  send(prompt: string, onEvent: (e: AgentEvent) => void, mockLines?: string[]): Promise<void>;
  processNdjsonLines(lines: string[], onEvent: (e: AgentEvent) => void): void;
}

const FIXTURES_DIR = path.resolve(process.cwd(), 'spikes', 'fixtures');

describe('Adapters: Claude, Codex, Gemini & AgentRegistry (Luật P5, P10, B3, B4)', () => {
  let db: Database.Database;
  let tempDir: string;
  let modelsService: ModelTierService;
  let sessionRepo: AgentSessionRepository;

  beforeEach(() => {
    tempDir = path.resolve(
      process.cwd(),
      'spikes',
      '.tmp',
      `adapters-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ClaudeAdapter', () => {
    it('phát hiện trạng thái detect: not_installed, not_logged_in, ready', async () => {
      // 1. Chưa cài
      const notInstalledRunner: CommandRunner = async () => ({
        stdout: '',
        stderr: 'claude: command not found',
        code: 127,
      });
      const adapter1 = new ClaudeAdapter(modelsService, sessionRepo, notInstalledRunner);
      const res1 = await adapter1.detect();
      expect(res1.installed).toBe(false);
      expect(res1.status).toBe('not_installed');

      // 2. Đã cài nhưng chưa login
      const notLoggedInRunner: CommandRunner = async (_cmd, args) => {
        if (args.includes('--version')) {
          return { stdout: 'claude-code 1.2.0', stderr: '', code: 0 };
        }
        return { stdout: '{"loggedIn":false}', stderr: '', code: 0 };
      };
      const adapter2 = new ClaudeAdapter(modelsService, sessionRepo, notLoggedInRunner);
      const res2 = await adapter2.detect();
      expect(res2.installed).toBe(true);
      expect(res2.loggedIn).toBe(false);
      expect(res2.status).toBe('not_logged_in');

      // 3. Sẵn sàng
      const readyRunner: CommandRunner = async (_cmd, args) => {
        if (args.includes('--version')) {
          return { stdout: 'claude-code 1.2.0', stderr: '', code: 0 };
        }
        return { stdout: '{"loggedIn":true}', stderr: '', code: 0 };
      };
      const adapter3 = new ClaudeAdapter(modelsService, sessionRepo, readyRunner);
      const res3 = await adapter3.detect();
      expect(res3.installed).toBe(true);
      expect(res3.loggedIn).toBe(true);
      expect(res3.status).toBe('ready');
      expect(res3.modelsCount).toBeGreaterThan(0);
    });

    it('chạy fixture stream-turn.ndjson và lưu file an toàn trong thư mục dự án (B4)', async () => {
      const adapter = new ClaudeAdapter(modelsService, sessionRepo);
      const projectCwd = path.join(tempDir, 'claude-project');
      fs.mkdirSync(projectCwd, { recursive: true });

      const session = await adapter.startSession({
        cwd: projectCwd,
        model: 'claude-sonnet-4-5',
      });

      const fixtureContent = fs.readFileSync(
        path.join(FIXTURES_DIR, 'claude', 'stream-turn.ndjson'),
        'utf8',
      );
      const lines = fixtureContent.trim().split(/\r?\n/);

      const events: AgentEvent[] = [];
      await (session as unknown as MockableSession).send(
        'Tạo trang chủ',
        (e: AgentEvent) => events.push(e),
        lines,
      );

      expect(session.getExternalSessionId()).toBe('sess_claude_001');

      // Kiểm tra file được ghi trong projectCwd
      const createdFile = path.join(projectCwd, 'index.html');
      expect(fs.existsSync(createdFile)).toBe(true);
      expect(fs.readFileSync(createdFile, 'utf8')).toContain('Tiệm Bánh Nhỏ');

      const fileChangeEvent = events.find((e) => e.type === 'file_change');
      expect(fileChangeEvent).toBeDefined();

      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
    });

    it('chặn đứng AI nếu cố tình ghi ra ngoài thư mục dự án theo Luật B4', async () => {
      const adapter = new ClaudeAdapter(modelsService, sessionRepo);
      const projectCwd = path.join(tempDir, 'claude-b4-test');
      fs.mkdirSync(projectCwd, { recursive: true });

      const session = await adapter.startSession({ cwd: projectCwd });

      const maliciousLines = [
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Write',
                input: {
                  file_path: '../../escaped-hack.txt',
                  content: 'ATTACK',
                },
              },
            ],
          },
        }),
      ];

      expect(() => {
        (session as unknown as MockableSession).processNdjsonLines(maliciousLines, () => {});
      }).toThrow(PathViolationError);

      expect(fs.existsSync(path.resolve(projectCwd, '../../escaped-hack.txt'))).toBe(false);
    });

    it('phân tích fixture statusline quota Tier A chính xác', () => {
      const adapter = new ClaudeAdapter(modelsService, sessionRepo);
      const raw = fs.readFileSync(
        path.join(FIXTURES_DIR, 'claude', 'statusline-quota.json'),
        'utf8',
      );
      const snap = adapter.parseQuotaTierA(raw);

      expect(snap.source).toBe('official');
      expect(snap.status).toBe('ok');
      expect(snap.windows.length).toBe(2);
      expect(snap.windows[0]?.usedPercent).toBe(62);
    });
  });

  describe('CodexAdapter', () => {
    it('phát hiện trạng thái detect: not_installed và ready', async () => {
      const runner: CommandRunner = async (_cmd, args) => {
        if (args.includes('--version')) {
          return { stdout: 'codex-cli 0.9.1', stderr: '', code: 0 };
        }
        return { stdout: 'Logged in as test@openai.com', stderr: '', code: 0 };
      };
      const adapter = new CodexAdapter(modelsService, sessionRepo, runner);
      const res = await adapter.detect();

      expect(res.installed).toBe(true);
      expect(res.loggedIn).toBe(true);
      expect(res.status).toBe('ready');
    });

    it('chạy fixture exec-stream.ndjson và cập nhật session thread id', async () => {
      const adapter = new CodexAdapter(modelsService, sessionRepo);
      const projectCwd = path.join(tempDir, 'codex-project');
      fs.mkdirSync(projectCwd, { recursive: true });

      const session = await adapter.startSession({
        cwd: projectCwd,
        model: 'gpt-5-codex',
      });

      const fixtureContent = fs.readFileSync(
        path.join(FIXTURES_DIR, 'codex', 'exec-stream.ndjson'),
        'utf8',
      );
      const lines = fixtureContent.trim().split(/\r?\n/);

      const events: AgentEvent[] = [];
      await (session as unknown as MockableSession).send(
        'Thêm sản phẩm',
        (e: AgentEvent) => events.push(e),
        lines,
      );

      expect(session.getExternalSessionId()).toBe('thr_codex_001');

      const messageEvt = events.find((e) => e.type === 'message');
      expect(messageEvt).toBeDefined();

      const doneEvt = events.find((e) => e.type === 'done');
      expect(doneEvt).toBeDefined();
    });

    it('ước lượng quota Tier B từ fixture session-log-usage.jsonl', () => {
      const adapter = new CodexAdapter(modelsService, sessionRepo);
      const raw = fs.readFileSync(
        path.join(FIXTURES_DIR, 'codex', 'session-log-usage.jsonl'),
        'utf8',
      );
      const snap = adapter.estimateQuotaTierB(raw, 140000, 80);

      expect(snap.source).toBe('estimated');
      expect(snap.status).toBe('low');
      expect(snap.windows[0]?.usedPercent).toBe(82);
    });
  });

  describe('GeminiAdapter', () => {
    it('chạy fixture stream-turn.ndjson và acp-session-updates.ndjson', async () => {
      const adapter = new GeminiAdapter(modelsService, sessionRepo);
      const projectCwd = path.join(tempDir, 'gemini-project');
      fs.mkdirSync(projectCwd, { recursive: true });

      const session = await adapter.startSession({
        cwd: projectCwd,
        model: 'gemini-2.5-flash',
      });

      // Fixture 1: stream-turn
      const streamLines = fs
        .readFileSync(path.join(FIXTURES_DIR, 'gemini', 'stream-turn.ndjson'), 'utf8')
        .trim()
        .split(/\r?\n/);
      const events1: AgentEvent[] = [];
      await (session as unknown as MockableSession).send(
        'Cập nhật giao diện',
        (e: AgentEvent) => events1.push(e),
        streamLines,
      );
      expect(events1.some((e) => e.type === 'done')).toBe(true);

      // Fixture 2: acp-session-updates
      const acpLines = fs
        .readFileSync(path.join(FIXTURES_DIR, 'gemini', 'acp-session-updates.ndjson'), 'utf8')
        .trim()
        .split(/\r?\n/);
      const events2: AgentEvent[] = [];
      await (session as unknown as MockableSession).send(
        'Tạo giỏ hàng',
        (e: AgentEvent) => events2.push(e),
        acpLines,
      );
      expect(events2.some((e) => e.type === 'plan')).toBe(true);
      expect(events2.some((e) => e.type === 'tool_call')).toBe(true);
    });

    it('bắt lỗi rate_limit 429 và trích xuất model từ fixture rate-limit-429.json (Tier C)', () => {
      const adapter = new GeminiAdapter(modelsService, sessionRepo);
      const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'gemini', 'rate-limit-429.json'), 'utf8');
      const snap = adapter.parseRateLimitTierC(raw);

      expect(snap.scope).toBe('model');
      expect(snap.model).toBe('gemini-2.5-pro');
      expect(snap.status).toBe('exhausted');
      expect(snap.source).toBe('detected');
    });
  });

  describe('AgentRegistry', () => {
    it('detectAll() trả về trạng thái của cả 3 AI CLI', async () => {
      const registry = new AgentRegistry({
        modelsService,
        sessionRepo,
      });

      const results = await registry.detectAll();
      expect(results.length).toBe(3);
      const agentIds = results.map((r) => r.agentId);
      expect(agentIds).toContain('claude');
      expect(agentIds).toContain('codex');
      expect(agentIds).toContain('gemini');
    });

    it('mở cửa sổ login bằng lệnh chính thức qua terminalLauncher theo Luật B3', async () => {
      let launchedCommand = '';
      const registry = new AgentRegistry({
        modelsService,
        sessionRepo,
        terminalLauncher: async (cmd) => {
          launchedCommand = cmd;
        },
      });

      await registry.openLoginTerminal('claude');
      expect(launchedCommand).toBe('claude auth login');

      await registry.openLoginTerminal('codex');
      expect(launchedCommand).toMatch(/(?:codex|codex\.exe"?) login/);

      await registry.openLoginTerminal('gemini');
      expect(launchedCommand).toBe('gemini auth login');
    });
  });
});
