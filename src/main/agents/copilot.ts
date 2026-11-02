import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertPathInsideProject } from '../security/path-guard';
import { getCommandExecutionOptions, resolveAgentBinary } from './binary-resolver';
import { type CommandRunner, defaultCommandRunner } from './claude';
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

    // Kiểm tra trạng thái auth
    let loggedIn = false;
    let status: 'ready' | 'not_logged_in' | 'error' = 'not_logged_in';

    const authRes = await this.runner(binary, ['auth', 'status']);
    const combinedOutput = `${authRes.stdout} ${authRes.stderr}`.toLowerCase();

    if (
      authRes.code === 0 ||
      combinedOutput.includes('logged in to') ||
      combinedOutput.includes('active account: true')
    ) {
      loggedIn = true;
      status = 'ready';
    } else {
      // Fallback: Kiểm tra file ~/.config/gh/hosts.yml hoặc %APPDATA%\GitHub CLI\hosts.yml
      try {
        const home = os.homedir();
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        const candidatePaths = [
          path.join(appData, 'GitHub CLI', 'hosts.yml'),
          path.join(home, '.config', 'gh', 'hosts.yml'),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            if (content.includes('github.com') && (content.includes('oauth_token') || content.includes('user:'))) {
              loggedIn = true;
              status = 'ready';
              break;
            }
          }
        }
      } catch {
        // bỏ qua lỗi đọc file
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

  public async getQuota(): Promise<QuotaSnapshot[]> {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.parseRateLimitTierC(raw)];
      }
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
    );
  }
}

export class CopilotSessionInstance implements AgentSession {
  public readonly id: string;
  public readonly agentId = 'copilot' as const;
  public readonly cwd: string;
  public readonly model: string | null;
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

    const args = this.binary.endsWith('gh') || this.binary.endsWith('gh.exe')
      ? ['copilot', 'explain', prompt]
      : ['--stream'];

    if (this.model && !this.binary.includes('gh')) {
      args.push('--model', this.model);
    }
    if (this.externalSessionId && !this.binary.includes('gh')) {
      args.push('--session', this.externalSessionId);
    }

    const execOpts = getCommandExecutionOptions(this.binary);
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, {
        cwd: this.cwd,
        shell: execOpts.shell,
      });

      let buffer = '';
      child.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        this.processNdjsonLines(lines, onEvent);
      });

      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('429') || text.toLowerCase().includes('rate limit')) {
          this.adapter.parseRateLimitTierC(text);
          onEvent({ type: 'rate_limit', model: this.model ?? undefined });
        }
      });

      child.on('close', (code) => {
        if (buffer.trim()) {
          this.processNdjsonLines([buffer.trim()], onEvent);
        }
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Copilot process exited with code ${code}`));
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
        onEvent({ type: 'message', text: line });
        continue;
      }

      if (evt.type === 'init' && typeof evt.session_id === 'string') {
        this.externalSessionId = evt.session_id;
        this.sessionRepo.updateExternalId(this.id, evt.session_id);
      } else if (evt.type === 'message' && typeof evt.content === 'string') {
        onEvent({ type: 'message', text: evt.content });
      } else if (evt.type === 'result') {
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

  public async cancel(): Promise<void> {}
}
