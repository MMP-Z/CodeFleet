import { spawn } from 'node:child_process';
import { shell } from 'electron';
import { ClaudeAdapter } from './claude';
import { CodexAdapter } from './codex';
import { GeminiAdapter } from './gemini';
import type { ModelTierService } from './models';
import type { AgentSessionRepository } from './session-repo';
import type { AgentAdapter, AgentId, DetectResult } from './types';

export interface AgentRegistryOptions {
  modelsService: ModelTierService;
  sessionRepo: AgentSessionRepository;
  customAdapters?: AgentAdapter[];
  terminalLauncher?: (command: string) => Promise<void>;
  urlOpener?: (url: string) => Promise<void>;
}

export const defaultTerminalLauncher = async (command: string): Promise<void> => {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', command], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', ['-a', 'Terminal', command], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else {
    spawn('x-terminal-emulator', ['-e', command], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
};

export const defaultUrlOpener = async (url: string): Promise<void> => {
  await shell.openExternal(url);
};

/**
 * Registry quản lý các AI CLI adapter có sẵn và tích hợp thêm từ plugin.
 */
export class AgentRegistry {
  private readonly adapters: Map<AgentId, AgentAdapter> = new Map();
  private readonly terminalLauncher: (command: string) => Promise<void>;
  private readonly urlOpener: (url: string) => Promise<void>;

  public constructor(options: AgentRegistryOptions) {
    this.terminalLauncher = options.terminalLauncher ?? defaultTerminalLauncher;
    this.urlOpener = options.urlOpener ?? defaultUrlOpener;

    if (options.customAdapters) {
      for (const a of options.customAdapters) {
        this.adapters.set(a.id, a);
      }
    } else {
      const claude = new ClaudeAdapter(options.modelsService, options.sessionRepo);
      const codex = new CodexAdapter(options.modelsService, options.sessionRepo);
      const gemini = new GeminiAdapter(options.modelsService, options.sessionRepo);
      this.adapters.set(claude.id, claude);
      this.adapters.set(codex.id, codex);
      this.adapters.set(gemini.id, gemini);
    }
  }

  public register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public get(agentId: AgentId): AgentAdapter | undefined {
    return this.adapters.get(agentId);
  }

  public getAdapter(agentId: AgentId): AgentAdapter {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`AI CLI adapter not registered: ${agentId}`);
    }
    return adapter;
  }

  public getAllAdapters(): AgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Phát hiện trạng thái cài đặt, đăng nhập và số model của tất cả AI CLI đã đăng ký.
   */
  public async detectAll(): Promise<DetectResult[]> {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        return await adapter.detect();
      } catch (err) {
        return {
          agentId: adapter.id,
          displayName: adapter.displayName,
          shortName: adapter.shortName,
          logoLetter: adapter.logoLetter,
          color: adapter.color,
          darkColor: adapter.darkColor,
          docsUrl: adapter.docsUrl,
          installCommand: adapter.installCommand,
          loginCommand: adapter.loginCommand,
          installed: false,
          version: null,
          loggedIn: false,
          status: 'error' as const,
          errorDetail: err instanceof Error ? err.message : String(err),
          modelsCount: 0,
        };
      }
    });
    return Promise.all(promises);
  }

  /**
   * LUẬT B3: Mở cửa sổ dòng lệnh OS chạy lệnh đăng nhập chính thức của CLI.
   * Tuyệt đối không can thiệp, không tự nhập và không đọc trích xuất token.
   */
  public async openLoginTerminal(agentId: AgentId): Promise<void> {
    const adapter = this.getAdapter(agentId);
    await this.terminalLauncher(adapter.loginCommand);
  }

  /**
   * Mở trang tài liệu chính thức của hãng trong trình duyệt mặc định.
   */
  public async openDocsUrl(agentId: AgentId): Promise<void> {
    const adapter = this.getAdapter(agentId);
    await this.urlOpener(adapter.docsUrl);
  }
}
