import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stopAgentProcess } from './stop-process';
import path from 'node:path';
import { redactSensitiveText } from '../logger/redactor';
import { assertPathInsideProject } from '../security/path-guard';
import { isGitHubCli, resolveAgentBinary } from './binary-resolver';
import { type CommandRunner, defaultCommandRunner } from './claude';
import { getCopilotAuthStatus, getCopilotQuota } from './copilot-auth';
import type { ModelTierService } from './models';
import type { AgentSessionRepository } from './session-repo';
import type {
  AgentAdapter,
  AgentEvent,
  AgentSession,
  DetectResult,
  ModelInfo,
  QuotaSnapshot,
  StartSessionOptions,
} from './types';

function copilotExecutable(binary: string): { command: string; prefix: string[] } {
  if (process.platform !== 'win32' || !/\.cmd$/i.test(binary)) {
    return { command: binary, prefix: [] };
  }
  // Run npm's JavaScript entry directly so cmd.exe never interprets prompt text.
  const packageDir = path.join(path.dirname(binary), 'node_modules', '@github', 'copilot');
  try {
    const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.copilot;
    if (typeof entry === 'string') {
      return {
        command: process.versions.electron ? 'node' : process.execPath,
        prefix: [path.resolve(packageDir, entry)],
      };
    }
  } catch {
    // Report an actionable error when npm's launcher points at a missing package.
  }
  throw new Error(
    'Không tìm thấy chương trình Copilot phía sau launcher npm. Kiểm tra lại bản cài Copilot CLI.',
  );
}

/**
 * Adapter cho GitHub Copilot CLI (hoặc gh copilot)
 */
export class CopilotAdapter implements AgentAdapter {
  public readonly id = 'copilot' as const;
  public readonly displayName: string;
  public readonly shortName: string;
  public readonly logoLetter: string;
  public readonly color: string;
  public readonly darkColor: string;
  public readonly docsUrl: string;
  public readonly installCommand: string;
  public readonly loginCommand: string;
  private lastRateLimitSnapshot: QuotaSnapshot | null = null;

  public constructor(
    private readonly modelsService: ModelTierService,
    private readonly sessionRepo: AgentSessionRepository,
    private readonly runner: CommandRunner = defaultCommandRunner,
    private readonly customQuotaResolver?: () => Promise<string | null>,
    private readonly quotaFetcher: (binary: string) => Promise<unknown> = getCopilotQuota,
  ) {
    const config = this.modelsService.getAgentCatalogConfig('copilot');
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName('copilot');
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand('copilot');
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

    const usesGitHubCli = isGitHubCli(binary);
    const authenticated = usesGitHubCli
      ? (await this.runner(binary, ['auth', 'status'])).code === 0
      : await getCopilotAuthStatus(binary);
    const status = authenticated === null ? 'error' : authenticated ? 'ready' : 'not_logged_in';

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
      loginCommand: usesGitHubCli ? 'gh auth login' : this.loginCommand,
      installed: true,
      version,
      loggedIn: authenticated === true,
      status,
      errorDetail: status === 'error' ? 'Không xác minh được trạng thái đăng nhập Copilot.' : null,
      modelsCount: models.length,
    };
  }

  public async listModels(): Promise<ModelInfo[]> {
    const defaults = this.modelsService.getCatalogDefaultModels(this.id);
    return this.modelsService.syncAgentModels(this.id, defaults);
  }

  public parseRateLimitTierC(rawJson: string): QuotaSnapshot {
    const now = new Date().toISOString();
    try {
      const obj = JSON.parse(rawJson);
      const msg = obj?.error?.message ?? (typeof obj === 'string' ? obj : '');
      const modelMatch = msg.match(/model '([^']+)'/) || [null, obj?.error?.data?.model ?? null];
      const model = modelMatch[1] ?? null;
      const snap: QuotaSnapshot = {
        agentId: this.id,
        model,
        scope: model ? 'model' : 'shared',
        windows: [{ label: 'Phút', usedPercent: 100, resetsAt: null }],
        status: 'exhausted',
        source: 'detected',
        updatedAt: now,
      };
      this.lastRateLimitSnapshot = snap;
      return snap;
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

  /** Convert Copilot's `account.getQuota` reply (monthly premium requests) to a snapshot. */
  public parseAccountQuota(result: unknown): QuotaSnapshot | null {
    const snapshots = (result as { quotaSnapshots?: Record<string, unknown> } | null)
      ?.quotaSnapshots;
    const premium = snapshots?.premium_interactions as
      | {
          isUnlimitedEntitlement?: unknown;
          entitlementRequests?: unknown;
          usedRequests?: unknown;
          remainingPercentage?: unknown;
          resetDate?: unknown;
        }
      | undefined;
    if (!premium || typeof premium !== 'object') return null;
    let usedPercent: number | null = null;
    if (premium.isUnlimitedEntitlement === true) usedPercent = 0;
    else if (typeof premium.remainingPercentage === 'number')
      usedPercent = 100 - premium.remainingPercentage;
    else if (
      typeof premium.usedRequests === 'number' &&
      typeof premium.entitlementRequests === 'number' &&
      premium.entitlementRequests > 0
    )
      usedPercent = (premium.usedRequests / premium.entitlementRequests) * 100;
    if (usedPercent === null || !Number.isFinite(usedPercent)) return null;
    usedPercent = Math.max(0, Math.min(100, Math.round(usedPercent * 10) / 10));
    const reset = typeof premium.resetDate === 'string' ? Date.parse(premium.resetDate) : NaN;
    const label =
      typeof premium.usedRequests === 'number' &&
      typeof premium.entitlementRequests === 'number' &&
      premium.entitlementRequests > 0
        ? `Tháng (${premium.usedRequests}/${premium.entitlementRequests})`
        : 'Tháng';
    return {
      agentId: this.id,
      model: null,
      scope: 'shared',
      windows: [
        {
          label,
          usedPercent,
          // Copilot sometimes reports the fetch time instead of the real reset date.
          resetsAt: Number.isFinite(reset) && reset > Date.now() ? new Date(reset).toISOString() : null,
        },
      ],
      status: usedPercent >= 100 ? 'exhausted' : usedPercent >= 80 ? 'low' : 'ok',
      source: 'official',
      updatedAt: new Date().toISOString(),
    };
  }

  public async getQuota(): Promise<QuotaSnapshot[]> {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.parseRateLimitTierC(raw)];
      }
    }
    const binary = resolveAgentBinary(this.id);
    if (!isGitHubCli(binary)) {
      const official = this.parseAccountQuota(await this.quotaFetcher(binary));
      if (official) return [official];
    }
    if (this.lastRateLimitSnapshot) {
      return [this.lastRateLimitSnapshot];
    }
    return [
      {
        agentId: this.id,
        model: null,
        scope: 'shared',
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

    return new CopilotSessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      this,
      binary,
      opts.readOnly,
    );
  }
}

export class CopilotSessionInstance implements AgentSession {
  public readonly id: string;
  public readonly agentId = 'copilot' as const;
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
    public readonly adapter: CopilotAdapter,
    binary = 'copilot',
    private readonly readOnly = false,
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

    const legacy = isGitHubCli(this.binary);
    const { command, prefix } = legacy
      ? { command: this.binary, prefix: [] }
      : copilotExecutable(this.binary);
    const args = legacy
      ? ['copilot', 'explain', '--', prompt]
      : ['--output-format', 'json', '--stream', 'on', '--no-auto-update'];
    if (!legacy) {
      if (this.readOnly) args.push('--available-tools=view,grep,glob');
      if (this.model) args.push('--model', this.model);
      if (this.externalSessionId) args.push('--resume', this.externalSessionId);
      args.push('--prompt=' + prompt);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, [...prefix, ...args], {
        cwd: this.cwd,
        windowsHide: true,
      });

      this.child = child;
      child.stdin?.on('error', () => {});
      child.stdin?.end();
      let buffer = '';
      let stderr = '';
      const streamedMessages = new Set<string>();
      child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
        if (legacy) {
          onEvent({ type: 'message', text: chunk });
          return;
        }
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        this.processNdjsonLines(lines, onEvent, streamedMessages);
      });

      child.stderr?.setEncoding('utf8').on('data', (text: string) => {
        stderr = (stderr + text).slice(-8192);
        if (text.includes('429') || text.toLowerCase().includes('rate limit')) {
          this.adapter.parseRateLimitTierC(text);
          onEvent({ type: 'rate_limit', model: this.model ?? undefined });
        }
      });

      child.on('close', (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer.trim()], onEvent, streamedMessages);
        }
        if (code === 0) {
          if (legacy) onEvent({ type: 'done' });
          resolve();
        } else {
          const detail = redactSensitiveText(stderr).trim().split(/\r?\n/).slice(-6).join('\n');
          reject(new Error(detail || `Copilot process exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  public processNdjsonLines(
    lines: string[],
    onEvent: (e: AgentEvent) => void,
    streamedMessages = new Set<string>(),
  ): void {
    for (const line of lines) {
      if (!line.trim()) continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(line) as Record<string, unknown>;
      } catch {
        onEvent({ type: 'message', text: line });
        continue;
      }

      if (!evt || typeof evt !== 'object') continue;
      const data = evt.data as Record<string, unknown> | undefined;
      const sessionId = evt.type === 'session.start' ? data?.sessionId : evt.session_id;
      if ((evt.type === 'init' || evt.type === 'session.start') && typeof sessionId === 'string') {
        this.externalSessionId = sessionId;
        this.sessionRepo.updateExternalId(this.id, sessionId);
      } else if (evt.type === 'assistant.message_delta' && typeof data?.deltaContent === 'string') {
        if (typeof data.messageId === 'string') streamedMessages.add(data.messageId);
        onEvent({ type: 'message', text: data.deltaContent });
      } else if (evt.type === 'assistant.message' && typeof data?.content === 'string') {
        if (typeof data.messageId !== 'string' || !streamedMessages.delete(data.messageId)) {
          onEvent({ type: 'message', text: data.content });
        }
      } else if (evt.type === 'session.error') {
        const message =
          typeof data?.message === 'string'
            ? redactSensitiveText(data.message)
            : 'Copilot báo lỗi trong phiên.';
        if (/429|rate.limit|usage.limit/i.test(message)) {
          onEvent({ type: 'rate_limit', model: this.model ?? undefined });
        } else {
          onEvent({ type: 'error', message });
        }
      } else if (evt.type === 'message' && typeof evt.content === 'string') {
        onEvent({ type: 'message', text: evt.content });
      } else if (evt.type === 'result') {
        if (typeof evt.exitCode === 'number' && evt.exitCode !== 0) continue;
        const stats = evt.stats as { input_tokens?: number; output_tokens?: number } | undefined;
        onEvent({
          type: 'done',
          externalSessionId: this.externalSessionId ?? undefined,
          usage: stats
            ? {
                inputTokens: stats.input_tokens ?? 0,
                outputTokens: stats.output_tokens ?? 0,
              }
            : undefined,
        });
      } else if (evt.jsonrpc === '2.0' && evt.method === 'session/update') {
        const params = evt.params as
          { sessionId?: string; update?: Record<string, unknown> } | undefined;
        const u = params?.update as
          | {
              sessionUpdate?: string;
              entries?: Array<{ content: string; status?: string }>;
              toolCallId?: string;
              kind?: string;
              title?: string;
              status?: string;
              content?: { text?: string };
            }
          | undefined;
        if (params?.sessionId && !this.externalSessionId) {
          this.externalSessionId = params.sessionId;
          this.sessionRepo.updateExternalId(this.id, params.sessionId);
        }
        if (u?.sessionUpdate === 'plan') {
          onEvent({
            type: 'plan',
            steps: (u.entries ?? []).map((en) => ({
              title: en.content,
              status: en.status ?? 'in_progress',
            })),
          });
        } else if (u?.sessionUpdate === 'tool_call') {
          onEvent({
            type: 'tool_call',
            id: u.toolCallId ?? `tc_${Date.now()}`,
            kind: u.kind ?? 'tool',
            title: u.title ?? 'Tool call',
            status: u.status ?? 'completed',
          });
          if (u.title && typeof u.title === 'string' && u.title.startsWith('Write ')) {
            const targetPath = u.title.replace(/^Write\s+/, '').trim();
            const safePath = assertPathInsideProject(this.cwd, targetPath);
            onEvent({
              type: 'file_change',
              path: path.relative(this.cwd, safePath).replace(/\\/g, '/'),
            });
          }
        } else if (u?.sessionUpdate === 'agent_message_chunk' && u.content?.text) {
          onEvent({ type: 'message', text: u.content.text });
        }
      } else if (
        evt.error &&
        typeof evt.error === 'object' &&
        (String((evt.error as { code?: unknown }).code) === '429' ||
          String((evt.error as { message?: unknown }).message).includes('429'))
      ) {
        this.adapter.parseRateLimitTierC(line);
        onEvent({ type: 'rate_limit', model: this.model ?? undefined });
      }
    }
  }

  public async respondPermission(): Promise<void> {}

  public async cancel(): Promise<void> {
    await stopAgentProcess(this.child);
  }
}
