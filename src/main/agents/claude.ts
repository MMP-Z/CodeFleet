import { spawn } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import { assertPathInsideProject, writeProjectFileSafe } from '../security/path-guard';
import { getCommandExecutionOptions, resolveAgentBinary } from './binary-resolver';
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

const ClaudeStatuslineSchema = z.object({
  rate_limits: z
    .object({
      five_hour: z
        .object({
          used_percentage: z.number(),
          resets_at: z.number(),
        })
        .optional(),
      seven_day: z
        .object({
          used_percentage: z.number(),
          resets_at: z.number(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});

export type CommandRunner = (
  cmd: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string; code: number }>;

export const defaultCommandRunner: CommandRunner = (cmd, args, options) => {
  return new Promise((resolve) => {
    try {
      const execOpts = getCommandExecutionOptions(cmd);
      const child = spawn(cmd, args, {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        shell: execOpts.shell,
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code ?? 0 });
      });
      child.on('error', (err) => {
        resolve({ stdout: '', stderr: err.message, code: 127 });
      });
    } catch (err) {
      resolve({
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        code: 127,
      });
    }
  });
};

export class ClaudeAdapter implements AgentAdapter {
  public readonly id = 'claude' as const;
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
    const config = this.modelsService.getAgentCatalogConfig('claude');
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName('claude');
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand('claude');
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
    const authRes = await this.runner(binary, ['status', '--json']);
    let loggedIn = false;
    let status: 'ready' | 'not_logged_in' | 'error' = 'not_logged_in';

    if (authRes.code === 0) {
      try {
        const parsed = JSON.parse(authRes.stdout);
        loggedIn = Boolean(parsed.loggedIn ?? parsed.authenticated ?? true);
        status = loggedIn ? 'ready' : 'not_logged_in';
      } catch {
        loggedIn = !authRes.stdout.toLowerCase().includes('not logged in');
        status = loggedIn ? 'ready' : 'not_logged_in';
      }
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

  public parseQuotaTierA(rawJson: string): QuotaSnapshot {
    const now = new Date().toISOString();
    try {
      const parsed = ClaudeStatuslineSchema.parse(JSON.parse(rawJson));
      if (!parsed.rate_limits) {
        return {
          agentId: this.id,
          model: null,
          scope: 'shared',
          windows: [],
          status: 'unknown',
          source: 'unknown',
          updatedAt: now,
        };
      }
      const windows = [];
      if (parsed.rate_limits.five_hour) {
        windows.push({
          label: '5 giờ',
          usedPercent: parsed.rate_limits.five_hour.used_percentage,
          resetsAt: new Date(parsed.rate_limits.five_hour.resets_at * 1000).toISOString(),
        });
      }
      if (parsed.rate_limits.seven_day) {
        windows.push({
          label: 'Tuần',
          usedPercent: parsed.rate_limits.seven_day.used_percentage,
          resetsAt: new Date(parsed.rate_limits.seven_day.resets_at * 1000).toISOString(),
        });
      }
      const maxPct = Math.max(...windows.map((w) => w.usedPercent ?? 0), 0);
      const status = maxPct >= 100 ? 'exhausted' : maxPct >= 80 ? 'low' : 'ok';
      return {
        agentId: this.id,
        model: null,
        scope: 'shared',
        windows,
        status,
        source: 'official',
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
        return [this.parseQuotaTierA(raw)];
      }
    }
    // Đọc thụ động từ Claude statusline nếu có
    const binary = resolveAgentBinary(this.id);
    const res = await this.runner(binary, ['status', '--json']);
    if (res.code === 0 && res.stdout) {
      return [this.parseQuotaTierA(res.stdout)];
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
    const binary = resolveAgentBinary(this.id);
    const sessionRecord = this.sessionRepo.createSession({
      cwd: opts.cwd,
      projectId: opts.projectId,
      agentId: this.id,
      model: opts.model ?? null,
      externalId: opts.resumeId,
    });

    return new ClaudeSessionInstance(
      sessionRecord.id,
      opts.cwd,
      opts.model ?? null,
      sessionRecord.externalId,
      this.sessionRepo,
      binary,
    );
  }
}

class ClaudeSessionInstance implements AgentSession {
  public readonly id: string;
  public readonly agentId = 'claude' as const;
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
    binary = 'claude',
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

    // Khi chạy thật với binary claude
    const args = ['--print', '--output-format', 'json'];
    if (this.model) {
      args.push('--model', this.model);
    }
    if (this.externalSessionId) {
      args.push('--resume', this.externalSessionId);
    }
    args.push(prompt);

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
          reject(new Error(`Claude process exited with code ${code}`));
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

      if (evt.type === 'system' && typeof evt.session_id === 'string') {
        this.externalSessionId = evt.session_id;
        this.sessionRepo.updateExternalId(this.id, evt.session_id);
      } else if (
        evt.type === 'assistant' &&
        evt.message &&
        typeof evt.message === 'object' &&
        Array.isArray((evt.message as { content?: unknown[] }).content)
      ) {
        const content = (evt.message as { content: unknown[] }).content;
        for (const rawItem of content) {
          const item = rawItem as {
            type?: string;
            text?: string;
            name?: string;
            id?: string;
            input?: { file_path?: string; content?: string };
          };
          if (item.type === 'text' && typeof item.text === 'string') {
            onEvent({ type: 'message', text: item.text });
          } else if (item.type === 'tool_use') {
            onEvent({
              type: 'tool_call',
              id: item.id ?? `tool_${Date.now()}`,
              kind: item.name ?? 'tool',
              title: `${item.name}: ${item.input?.file_path ?? ''}`,
              status: 'executing',
            });

            if (item.name === 'Write' || item.name === 'Edit') {
              const targetRel = item.input?.file_path;
              if (targetRel) {
                // LUẬT B4: Path Guard kiểm tra và chặn ghi ra ngoài
                const safePath = assertPathInsideProject(this.cwd, targetRel);
                if (item.input?.content !== undefined) {
                  writeProjectFileSafe(this.cwd, targetRel, item.input.content);
                }
                onEvent({
                  type: 'file_change',
                  path: path.relative(this.cwd, safePath).replace(/\\/g, '/'),
                });
              }
            }
          }
        }
      } else if (evt.type === 'result') {
        if (evt.is_error) {
          const errMsg = typeof evt.result === 'string' ? evt.result : 'Claude reported an error';
          if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit')) {
            onEvent({ type: 'rate_limit', model: this.model ?? undefined });
          } else {
            onEvent({ type: 'error', message: errMsg });
          }
        } else {
          const usage = evt.usage as { input_tokens?: number; output_tokens?: number } | undefined;
          onEvent({
            type: 'done',
            externalSessionId:
              this.externalSessionId ??
              (typeof evt.session_id === 'string' ? evt.session_id : undefined),
            usage: usage
              ? {
                  inputTokens: usage.input_tokens ?? 0,
                  outputTokens: usage.output_tokens ?? 0,
                }
              : undefined,
          });
        }
      }
    }
  }

  public async respondPermission(): Promise<void> {}

  public async cancel(): Promise<void> {}
}
