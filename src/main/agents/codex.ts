import { spawn } from 'node:child_process';
import path from 'node:path';
import { assertPathInsideProject } from '../security/path-guard';
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
    const res = await this.runner('codex', ['--version']);
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
    const authRes = await this.runner('codex', ['auth', 'status']);
    let loggedIn = false;
    let status: 'ready' | 'not_logged_in' | 'error' = 'not_logged_in';

    if (authRes.code === 0) {
      loggedIn = true;
      status = 'ready';
    } else if (
      authRes.stderr.toLowerCase().includes('login') ||
      authRes.stdout.toLowerCase().includes('login')
    ) {
      loggedIn = false;
      status = 'not_logged_in';
    } else {
      status = 'not_logged_in';
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

  public async getQuota(): Promise<QuotaSnapshot[]> {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        return [this.estimateQuotaTierB(raw)];
      }
    }
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
    );
  }
}

class CodexSessionInstance implements AgentSession {
  public readonly id: string;
  public readonly agentId = 'codex' as const;
  public readonly cwd: string;
  public readonly model: string | null;
  private externalSessionId: string | null;

  public constructor(
    id: string,
    cwd: string,
    model: string | null,
    externalSessionId: string | null,
    private readonly sessionRepo: AgentSessionRepository,
  ) {
    this.id = id;
    this.cwd = cwd;
    this.model = model;
    this.externalSessionId = externalSessionId;
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

    const args = ['exec', '--json'];
    if (this.model) {
      args.push('--model', this.model);
    }
    if (this.externalSessionId) {
      args.push('--thread', this.externalSessionId);
    }
    args.push(prompt);

    return new Promise((resolve, reject) => {
      const child = spawn('codex', args, {
        cwd: this.cwd,
        shell: process.platform === 'win32',
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
          reject(new Error(`Codex process exited with code ${code}`));
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
        const errMsg = typeof evt.message === 'string' ? evt.message : 'Codex reported an error';
        if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit')) {
          onEvent({ type: 'rate_limit', model: this.model ?? undefined });
        } else {
          onEvent({ type: 'error', message: errMsg });
        }
      }
    }
  }

  public async respondPermission(): Promise<void> {}

  public async cancel(): Promise<void> {}
}
