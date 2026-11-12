import { spawn, type ChildProcess } from 'node:child_process';
import { stopAgentProcess } from './stop-process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { redactSensitiveText } from '../logger/redactor';
import { assertPathInsideProject } from '../security/path-guard';
import { getCommandExecutionOptions, resolveAgentBinary } from './binary-resolver';
import { type CommandRunner, defaultCommandRunner } from './claude';
import type { ModelTierService } from './models';
import type { AgentSessionRepository } from './session-repo';
import type {
  AgentAdapter,
  AgentEvent,
  AgentSession,
  CodexSandboxMode,
  DetectResult,
  DiscoveredModel,
  ModelInfo,
  QuotaSnapshot,
  StartSessionOptions,
} from './types';

export class CodexAdapter implements AgentAdapter {
  public readonly id = 'codex' as const;
  public readonly displayName: string;
  public readonly shortName: string;
  public readonly logoLetter: string;
  public readonly color: string;
  public readonly darkColor: string;
  public readonly docsUrl: string;
  public readonly installCommand: string;
  public readonly loginCommand: string;

  public constructor(
    private readonly modelsService: ModelTierService,
    private readonly sessionRepo: AgentSessionRepository,
    private readonly runner: CommandRunner = defaultCommandRunner,
    private readonly customQuotaResolver?: () => Promise<string | null>,
  ) {
    const config = this.modelsService.getAgentCatalogConfig('codex');
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName('codex');
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand('codex');
    this.loginCommand = config.loginCommand;
  }

  public async detect(): Promise<DetectResult> {
    const binary = resolveAgentBinary(this.id);
    const res = await this.runner(binary, ['--version']);
    if (res.code !== 0) {
      return {
        agentId: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        logoLetter: this.logoLetter,
        color: this.color,
        darkColor: this.darkColor,
        docsUrl: this.docsUrl,
        installCommand: this.installCommand,
        loginCommand: this.loginCommand,
        installed: false,
        version: null,
        loggedIn: false,
        status: 'not_installed',
        errorDetail: res.stderr || null,
        modelsCount: 0,
      };
    }

    const versionMatch = res.stdout.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
    const version = versionMatch ? versionMatch[1] : res.stdout.trim() || 'unknown';

    // Kiểm tra trạng thái auth:
    // 1. Thử lệnh 'codex login status'
    // 2. Hoặc kiểm tra file cấu hình auth.json của Codex
    let loggedIn = false;
    let status: 'ready' | 'not_logged_in' | 'error' = 'not_logged_in';

    const authRes = await this.runner(binary, ['login', 'status']);
    const combinedAuthOutput = `${authRes.stdout} ${authRes.stderr}`.toLowerCase();

    if (
      authRes.code === 0 &&
      (combinedAuthOutput.includes('logged in') ||
        combinedAuthOutput.includes('chatgpt') ||
        combinedAuthOutput.includes('api key'))
    ) {
      loggedIn = true;
      status = 'ready';
    } else {
      // Fallback: Kiểm tra file ~/.codex/auth.json
      try {
        const authPath = path.join(os.homedir(), '.codex', 'auth.json');
        if (fs.existsSync(authPath)) {
          const authData = JSON.parse(fs.readFileSync(authPath, 'utf8')) as {
            tokens?: unknown;
            OPENAI_API_KEY?: unknown;
          };
          if (authData.tokens || authData.OPENAI_API_KEY) {
            loggedIn = true;
            status = 'ready';
          }
        }
      } catch {
        // bỏ qua nếu file auth.json hỏng
      }
    }

    const models = await this.listModels();

    return {
      agentId: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      logoLetter: this.logoLetter,
      color: this.color,
      darkColor: this.darkColor,
      docsUrl: this.docsUrl,
      installCommand: this.installCommand,
      loginCommand: this.loginCommand,
      installed: true,
      version,
      loggedIn,
      status,
      errorDetail: null,
      modelsCount: models.length,
    };
  }

  public async listModels(customCachePath?: string): Promise<ModelInfo[]> {
    const discovered: DiscoveredModel[] = [];

    // 1. Quét động các model thực tế từ ~/.codex/models_cache.json
    try {
      const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
      const cachePath = customCachePath || path.join(codexHome, 'models_cache.json');
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const parsed = JSON.parse(raw) as {
          models?: Array<{
            slug?: string;
            display_name?: string;
            visibility?: string;
          }>;
        };
        if (Array.isArray(parsed.models)) {
          for (const m of parsed.models) {
            if (m.slug && m.visibility !== 'hide') {
              discovered.push({
                id: m.slug,
                label: m.display_name || m.slug,
              });
            }
          }
        }
      }
    } catch {
      // bỏ qua lỗi đọc file cache
    }

    // 2. Fallback về catalog cấu hình nếu không tìm thấy cache
    if (discovered.length === 0) {
      const defaults = this.modelsService.getCatalogDefaultModels(this.id);
      return this.modelsService.syncAgentModels(this.id, defaults);
    }

    return this.modelsService.syncAgentModels(this.id, discovered);
  }

  public estimateQuotaTierB(
    jsonlText: string,
    fiveHourTokenCap = 140000,
    lowThreshold = 80,
  ): QuotaSnapshot {
    const now = new Date().toISOString();
    try {
      let totalTokens = 0;
      for (const line of jsonlText.trim().split(/\r?\n/)) {
        if (!line) continue;
        const evt = JSON.parse(line);
        if (evt.type === 'turn.completed' && evt.usage) {
          totalTokens += (evt.usage.input_tokens || 0) + (evt.usage.output_tokens || 0);
        }
      }
      const usedPercent = Math.min(100, Math.round((totalTokens / fiveHourTokenCap) * 100));
      const status = usedPercent >= 100 ? 'exhausted' : usedPercent >= lowThreshold ? 'low' : 'ok';
      return {
        agentId: this.id,
        model: null,
        scope: 'unknown',
        windows: [{ label: '5 giờ', usedPercent, resetsAt: null }],
        status,
        source: 'estimated',
        updatedAt: now,
      };
    } catch {
      return {
        agentId: this.id,
        model: null,
        scope: 'unknown',
        windows: [],
        status: 'unknown',
        source: 'unknown',
        updatedAt: now,
      };
    }
  }

  /**
   * Codex ghi `rate_limits` chính thức (giống `/status`) vào rollout log sau mỗi lượt.
   * Đọc thụ động bản ghi mới nhất, không gửi prompt nào.
   */
  public readSessionRateLimits(
    sessionsDir = path.join(
      process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
      'sessions',
    ),
  ): QuotaSnapshot | null {
    for (const file of this.recentRolloutFiles(sessionsDir)) {
      const snapshot = this.parseRateLimitsFromLog(this.readTail(file));
      if (snapshot) return snapshot;
    }
    return null;
  }

  public parseRateLimitsFromLog(text: string, now = Date.now()): QuotaSnapshot | null {
    const lines = text.split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index];
      if (!line.includes('"rate_limits"')) continue;
      try {
        const item = JSON.parse(line) as {
          timestamp?: string;
          payload?: { rate_limits?: unknown };
          rate_limits?: unknown;
        };
        const limits = (item.payload?.rate_limits ?? item.rate_limits) as
          Record<string, unknown> | null | undefined;
        if (!limits || typeof limits !== 'object') continue;
        const loggedAt = item.timestamp ? Date.parse(item.timestamp) : NaN;
        const windows = [];
        for (const key of ['primary', 'secondary']) {
          const window = limits[key] as
            | {
                used_percent?: unknown;
                window_minutes?: unknown;
                resets_at?: unknown;
                resets_in_seconds?: unknown;
              }
            | null
            | undefined;
          if (!window || typeof window.used_percent !== 'number') continue;
          const minutes = typeof window.window_minutes === 'number' ? window.window_minutes : null;
          let reset: number | null = null;
          if (typeof window.resets_at === 'number') {
            reset = window.resets_at > 1e11 ? window.resets_at : window.resets_at * 1000;
          } else if (typeof window.resets_in_seconds === 'number' && Number.isFinite(loggedAt)) {
            reset = loggedAt + window.resets_in_seconds * 1000;
          }
          // Cửa sổ đã reset sau bản ghi cuối cùng nghĩa là chưa dùng gì trong cửa sổ mới.
          const expired = reset !== null && reset <= now;
          windows.push({
            label:
              minutes === 300
                ? '5 giờ'
                : minutes === 10080
                  ? 'Tuần'
                  : minutes
                    ? `${minutes} phút`
                    : key === 'primary'
                      ? '5 giờ'
                      : 'Tuần',
            usedPercent: expired ? 0 : Math.max(0, Math.min(100, window.used_percent)),
            resetsAt: expired || reset === null ? null : new Date(reset).toISOString(),
          });
        }
        if (!windows.length) continue;
        const used = Math.max(...windows.map((window) => window.usedPercent));
        return {
          agentId: this.id,
          model: null,
          scope: 'shared',
          windows,
          status: used >= 100 ? 'exhausted' : used >= 80 ? 'low' : 'ok',
          source: 'official',
          updatedAt: Number.isFinite(loggedAt)
            ? new Date(loggedAt).toISOString()
            : new Date(now).toISOString(),
        };
      } catch {
        // bỏ qua dòng log hỏng hoặc bị cắt
      }
    }
    return null;
  }

  private recentRolloutFiles(sessionsDir: string, limit = 5): string[] {
    const files: { file: string; mtime: number }[] = [];
    const descendingDirs = (dir: string): string[] => {
      try {
        return fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
          .reverse();
      } catch {
        return [];
      }
    };
    // Cấu trúc sessions/YYYY/MM/DD/rollout-*.jsonl: chỉ quét vài ngày gần nhất.
    outer: for (const year of descendingDirs(sessionsDir)) {
      for (const month of descendingDirs(path.join(sessionsDir, year))) {
        for (const day of descendingDirs(path.join(sessionsDir, year, month))) {
          const dayDir = path.join(sessionsDir, year, month, day);
          try {
            for (const name of fs.readdirSync(dayDir)) {
              if (!name.endsWith('.jsonl')) continue;
              const file = path.join(dayDir, name);
              files.push({ file, mtime: fs.statSync(file).mtimeMs });
            }
          } catch {
            // bỏ qua thư mục không đọc được
          }
          if (files.length >= limit) break outer;
        }
      }
    }
    return files
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map((item) => item.file);
  }

  private readTail(file: string, bytes = 512 * 1024): string {
    let fd: number | null = null;
    try {
      fd = fs.openSync(file, 'r');
      const size = fs.fstatSync(fd).size;
      const length = Math.min(size, bytes);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      return buffer.toString('utf8');
    } catch {
      return '';
    } finally {
      if (fd !== null) fs.closeSync(fd);
    }
  }

  public async getQuota(): Promise<QuotaSnapshot[]> {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.estimateQuotaTierB(raw)];
      }
    }
    const official = this.readSessionRateLimits();
    if (official) return [official];
    return [
      {
        agentId: this.id,
        model: null,
        scope: 'unknown',
        windows: [],
        status: 'unknown',
        source: 'unknown',
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  public async startSession(opts: StartSessionOptions): Promise<AgentSession> {
    const binary = resolveAgentBinary(this.id);
    const sessionRecord = this.sessionRepo.createSession({
      cwd: opts.cwd,
      projectId: opts.projectId,
      agentId: this.id,
      model: opts.model ?? null,
      externalId: opts.resumeId,
    });

    return new CodexSessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      binary,
      opts.allowNonGitWorkspace,
      opts.readOnly,
      opts.codexSandbox,
    );
  }
}

class CodexSessionInstance implements AgentSession {
  public readonly id: string;
  public readonly agentId = 'codex' as const;
  public readonly cwd: string;
  public readonly model: string | null;
  private child: ChildProcess | null = null;
  private externalSessionId: string | null;
  private readonly binary: string;

  public constructor(
    id: string,
    cwd: string,
    model: string | null,
    externalSessionId: string | null,
    private readonly sessionRepo: AgentSessionRepository,
    binary = 'codex',
    private readonly allowNonGitWorkspace = false,
    private readonly readOnly = false,
    private readonly sandbox?: CodexSandboxMode,
  ) {
    this.id = id;
    this.cwd = cwd;
    this.model = model;
    this.externalSessionId = externalSessionId;
    this.binary = binary;
  }

  public getExternalSessionId(): string | null {
    return this.externalSessionId;
  }

  public async send(
    prompt: string,
    onEvent: (e: AgentEvent) => void,
    mockStreamLines?: string[],
  ): Promise<void> {
    if (mockStreamLines) {
      this.processNdjsonLines(mockStreamLines, onEvent);
      return;
    }

    const args = this.externalSessionId ? ['exec', 'resume', '--json'] : ['exec', '--json'];
    if (this.allowNonGitWorkspace) {
      args.push('--skip-git-repo-check');
    }
    const sandbox = this.readOnly ? 'read-only' : this.sandbox;
    if (sandbox) args.unshift('-c', `sandbox_mode="${sandbox}"`);
    if (this.model) {
      args.push('--model', this.model);
    }
    if (this.externalSessionId) args.push(this.externalSessionId);
    args.push('-');

    const execOpts = getCommandExecutionOptions(this.binary);
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, {
        cwd: this.cwd,
        shell: execOpts.shell,
      });

      this.child = child;
      child.stdin?.on('error', () => {});
      child.stdin?.end(prompt);
      let buffer = '';
      child.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        this.processNdjsonLines(lines, onEvent);
      });

      let stderr = '';
      child.stderr?.setEncoding('utf8').on('data', (text: string) => {
        stderr = (stderr + text).slice(-8192);
        if (text.includes('429') || text.toLowerCase().includes('rate limit')) {
          onEvent({ type: 'rate_limit', model: this.model ?? undefined });
        }
      });

      child.on('close', (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer.trim()], onEvent);
        }
        if (code === 0) {
          resolve();
        } else {
          const detail = redactSensitiveText(stderr)
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(
              (line) =>
                line && !/^Reading (?:additional input|prompt) from stdin\.{3}$/i.test(line),
            )
            .slice(-5)
            .join('\n');
          reject(new Error(detail || `Codex process exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  public processNdjsonLines(lines: string[], onEvent: (e: AgentEvent) => void): void {
    for (const line of lines) {
      if (!line.trim()) continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (evt.type === 'thread.started' && typeof evt.thread_id === 'string') {
        this.externalSessionId = evt.thread_id;
        this.sessionRepo.updateExternalId(this.id, evt.thread_id);
      } else if (evt.type === 'item.completed' && evt.item && typeof evt.item === 'object') {
        const item = evt.item as {
          type?: string;
          text?: string;
          changes?: Array<{ path?: string; kind?: string }>;
        };
        if (item.type === 'agent_message' && typeof item.text === 'string') {
          onEvent({ type: 'message', text: item.text });
        } else if (item.type === 'file_change' && Array.isArray(item.changes)) {
          for (const ch of item.changes) {
            if (ch.path) {
              // LUẬT B4: Path Guard kiểm tra và chặn thoát khỏi thư mục dự án
              const safePath = assertPathInsideProject(this.cwd, ch.path);
              onEvent({
                type: 'file_change',
                path: path.relative(this.cwd, safePath).replace(/\\/g, '/'),
              });
            }
          }
        }
      } else if (evt.type === 'turn.completed') {
        const usage = evt.usage as { input_tokens?: number; output_tokens?: number } | undefined;
        onEvent({
          type: 'done',
          externalSessionId: this.externalSessionId ?? undefined,
          usage: usage
            ? {
                inputTokens: usage.input_tokens ?? 0,
                outputTokens: usage.output_tokens ?? 0,
              }
            : undefined,
        });
      } else if (evt.type === 'error') {
        const errMsg =
          typeof evt.message === 'string'
            ? redactSensitiveText(evt.message)
            : 'Codex reported an error';
        if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit')) {
          onEvent({ type: 'rate_limit', model: this.model ?? undefined });
        } else {
          onEvent({ type: 'error', message: errMsg });
        }
      }
    }
  }

  public async respondPermission(): Promise<void> {}

  public async cancel(): Promise<void> {
    await stopAgentProcess(this.child);
  }
}
