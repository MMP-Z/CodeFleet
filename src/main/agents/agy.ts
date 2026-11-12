import { spawn, type ChildProcess } from 'node:child_process';
import { stopAgentProcess } from './stop-process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getCommandExecutionOptions, resolveAgentBinary } from './binary-resolver';
import { type CommandRunner, defaultCommandRunner } from './claude';
import type { ModelTierService } from './models';
import type { AgentSessionRepository } from './session-repo';
import type {
  AgentAdapter,
  AgentEvent,
  AgentSession,
  DetectResult,
  DiscoveredModel,
  ModelInfo,
  QuotaSnapshot,
  StartSessionOptions,
} from './types';

/**
 * Adapter cho Antigravity CLI (agy) - CLI phát triển mã nguồn hướng AI của Google Antigravity.
 */
export class AgyAdapter implements AgentAdapter {
  public readonly id = 'agy' as const;
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
    const config = this.modelsService.getAgentCatalogConfig('agy');
    this.displayName = config.displayName;
    this.shortName = this.modelsService.getAgentShortName('agy');
    this.logoLetter = config.logoLetter;
    this.color = config.color;
    this.darkColor = config.darkColor;
    this.docsUrl = config.docsUrl;
    this.installCommand = this.modelsService.getInstallCommand('agy');
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

    // Kiểm tra trạng thái đăng nhập:
    // 1. Thử lệnh 'agy models'
    // 2. Hoặc kiểm tra file cấu hình ~/.gemini/antigravity-cli/settings.json
    let loggedIn = false;
    let status: 'ready' | 'not_logged_in' | 'error' = 'not_logged_in';

    const modelsRes = await this.runner(binary, ['models']);
    if (
      modelsRes.code === 0 &&
      (modelsRes.stdout.toLowerCase().includes('fetching available models') ||
        modelsRes.stdout.toLowerCase().includes('gemini') ||
        modelsRes.stdout.toLowerCase().includes('claude') ||
        modelsRes.stdout.trim().length > 0)
    ) {
      loggedIn = true;
      status = 'ready';
    } else {
      // Fallback: Kiểm tra file settings hoặc installation_id của antigravity-cli
      try {
        const home = os.homedir();
        const settingsPath = path.join(home, '.gemini', 'antigravity-cli', 'settings.json');
        const installIdPath = path.join(home, '.gemini', 'antigravity-cli', 'installation_id');
        if (fs.existsSync(settingsPath) || fs.existsSync(installIdPath)) {
          loggedIn = true;
          status = 'ready';
        }
      } catch {
        // bỏ qua lỗi đọc file
      }
    }

    const models = await this.listModels(modelsRes.code === 0 ? modelsRes.stdout : undefined);

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

  public async listModels(rawModelsOutput?: string): Promise<ModelInfo[]> {
    const discovered: DiscoveredModel[] = [];

    if (rawModelsOutput) {
      // Phân tích output từ 'agy models':
      // Dạng: gemini-4-argon-medium\tGemini 4 Argon (Medium)
      const lines = rawModelsOutput.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Fetching')) continue;
        const parts = trimmed.split(/\t+|\s{2,}/);
        if (parts.length >= 2) {
          discovered.push({ id: parts[0].trim(), label: parts[1].trim() });
        } else if (parts.length === 1 && parts[0].includes('-')) {
          discovered.push({ id: parts[0].trim(), label: parts[0].trim() });
        }
      }
    }

    if (discovered.length === 0) {
      const defaults = this.modelsService.getCatalogDefaultModels(this.id);
      return this.modelsService.syncAgentModels(this.id, defaults);
    }

    return this.modelsService.syncAgentModels(this.id, discovered);
  }

  public async getQuota(model?: string): Promise<QuotaSnapshot[]> {
    if (this.customQuotaResolver) {
      const raw = await this.customQuotaResolver();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return [parsed];
        } catch {
          // bỏ qua lỗi json
        }
      }
    }
    const usage = await this.runner(resolveAgentBinary(this.id), [
      '--print',
      '/usage',
      '--print-timeout',
      '12s',
      '--output-format',
      'text',
    ]);
    if (usage.code === 0) {
      const windows = this.parseUsageWindows(usage.stdout, model);
      if (windows.length) {
        const used = Math.max(...windows.map((window) => window.usedPercent));
        return [
          {
            agentId: this.id,
            model: model && model !== 'auto' ? model : null,
            scope: model && model !== 'auto' ? 'model' : 'unknown',
            windows,
            status:
              !model || model === 'auto'
                ? 'unknown'
                : used >= 100
                  ? 'exhausted'
                  : used >= 80
                    ? 'low'
                    : 'ok',
            source: 'official',
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    }
    if (this.lastRateLimitSnapshot) {
      return [this.lastRateLimitSnapshot];
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

  private parseUsageWindows(output: string, model?: string) {
    const windows = new Map<
      string,
      { label: string; usedPercent: number; resetsAt: string | null }
    >();
    for (const line of output.split(/\r?\n/)) {
      const [group, limit, percent, reset] = line.split('\t').map((column) => column.trim());
      if (!group || !limit || !percent || !/^\d+(?:\.\d+)?%$/.test(percent)) continue;
      const remaining = Number(percent.slice(0, -1));
      if (remaining < 0 || remaining > 100) continue;
      const groupName = group.toLowerCase();
      const modelId = model?.toLowerCase();
      if (modelId && modelId !== 'auto') {
        const applies =
          groupName === 'gemini models'
            ? modelId.startsWith('gemini-')
            : groupName === 'claude and gpt models'
              ? /^(claude|gpt)-/.test(modelId)
              : modelId.startsWith(groupName.replace(/\s+/g, '-'));
        if (!applies) continue;
      }
      const label = /five hour/i.test(limit) ? '5 giờ' : /weekly/i.test(limit) ? 'Tuần' : null;
      if (!label) continue;
      const usedPercent = 100 - remaining;
      const current = windows.get(label);
      if (!current || usedPercent > current.usedPercent) {
        windows.set(label, {
          label,
          usedPercent,
          resetsAt: reset && Number.isFinite(Date.parse(reset)) ? reset : null,
        });
      }
    }
    return [...windows.values()];
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

    return new AgySessionInstance(
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

export class AgySessionInstance implements AgentSession {
  public readonly id: string;
  public readonly agentId = 'agy' as const;
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
    public readonly adapter: AgyAdapter,
    binary = 'agy',
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

    const args = ['--print', prompt, '--output-format', 'stream-json'];
    if (this.readOnly) args.push('--mode', 'plan', '--sandbox');
    if (this.model) {
      args.push('--model', this.model);
    }
    if (this.externalSessionId) {
      args.push('--conversation', this.externalSessionId);
    }

    const execOpts = getCommandExecutionOptions(this.binary);
    if (this.readOnly && execOpts.shell) throw new Error('Cần agy.exe để chạy subagent an toàn.');
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, {
        cwd: this.cwd,
        shell: execOpts.shell,
      });

      this.child = child;
      let buffer = '';
      child.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        this.processNdjsonLines(lines, onEvent);
      });

      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('RateLimit') || text.includes('ResourceExhausted')) {
          onEvent({
            type: 'rate_limit',
            model: this.model ?? undefined,
          });
        }
      });

      child.on('close', (code) => {
        this.child = null;
        if (buffer.trim()) {
          this.processNdjsonLines([buffer], onEvent);
        }
        if (code === 0) {
          onEvent({
            type: 'done',
            externalSessionId: this.externalSessionId ?? undefined,
          });
          resolve();
        } else {
          onEvent({
            type: 'error',
            message: `Antigravity CLI process exited with code ${code}`,
          });
          resolve();
        }
      });

      child.on('error', (err) => {
        onEvent({
          type: 'error',
          message: err.message,
        });
        reject(err);
      });
    });
  }

  public processNdjsonLines(lines: string[], onEvent: (e: AgentEvent) => void): void {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const item = JSON.parse(trimmed) as {
          event?: string;
          step_update?: {
            text_delta?: string;
            step_type?: string;
            state?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          result?: {
            conversation_id?: string;
            status?: string;
            response?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
        };

        if (item.event === 'step_update' && item.step_update?.text_delta) {
          onEvent({
            type: 'message',
            text: item.step_update.text_delta,
          });
        }

        if (item.event === 'result') {
          if (item.result?.conversation_id) {
            this.externalSessionId = item.result.conversation_id;
            this.sessionRepo.updateExternalId(this.id, item.result.conversation_id);
          }
          const usage = item.result?.usage;
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
        }
      } catch {
        // Fallback: nếu không phải JSON, chuyển thành message text thường
        onEvent({ type: 'message', text: trimmed });
      }
    }
  }

  public async respondPermission(_requestId: string, _optionId: string): Promise<void> {
    // Antigravity CLI print mode không yêu cầu interactive stdin permission
  }

  public async cancel(): Promise<void> {
    await stopAgentProcess(this.child);
  }
}
