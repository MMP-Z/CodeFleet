import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRegistry } from '../agents/detect';
import { ModelTierService } from '../agents/models';
import { AgentSessionRepository } from '../agents/session-repo';
import type { AgentAdapter, AgentEvent, AgentSession } from '../agents/types';
import { ConversationRepository } from '../db/conversation-repo';
import { DatabaseService } from '../db/database';
import { ProjectRepository } from '../db/project-repo';
import type { CliOptions } from './options';
import { collectTeamReports } from './team';

export interface TurnIO {
  message(text: string): void;
  status(text: string): void;
  permission(title: string): Promise<boolean>;
}

export class CliRuntime {
  public readonly registry: AgentRegistry;
  public readonly models: ModelTierService;
  public readonly conversations: ConversationRepository;
  public readonly projectId: string;
  public conversationId: string;
  private readonly db: DatabaseService;
  private readonly sessions = new Map<string, AgentSession>();
  private active: AgentSession | null = null;
  private readonly workers = new Set<AgentSession>();
  private cancelled = false;

  public constructor(
    public readonly options: CliOptions,
    customAdapters?: AgentAdapter[],
  ) {
    options.project = fs.realpathSync(path.resolve(options.project));
    if (!fs.statSync(options.project).isDirectory()) throw new Error('Dự án phải là thư mục.');
    const userDataDir = path.resolve(
      options.dataDir ?? process.env.CODEFLEET_HOME ?? path.join(os.homedir(), '.codefleet'),
    );
    this.db = new DatabaseService({ userDataDir });
    const db = this.db.openAndMigrate();
    try {
      const projects = new ProjectRepository(db);
      const project =
        projects.getByPath(options.project) ??
        projects.create({ name: path.basename(options.project), path: options.project });
      this.projectId = project.id;
      this.conversations = new ConversationRepository(db);
      this.models = new ModelTierService({
        db,
        userDataDir,
        defaultConfigPath: path.resolve(__dirname, '../../resources/model-tiers.default.json'),
      });
      this.registry = new AgentRegistry({
        modelsService: this.models,
        sessionRepo: new AgentSessionRepository(db),
        customAdapters,
      });
      if (options.resume) {
        const conv = this.conversations.getById(options.resume);
        if (!conv || conv.projectId !== project.id)
          throw new Error('Không tìm thấy hội thoại trong dự án này.');
        this.conversationId = conv.id;
      } else this.conversationId = this.conversations.create(project.id).id;
      if (options.agent !== 'auto') this.registry.getAdapter(options.agent);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  /** Đóng phiên agent hiện có để lượt sau mở phiên mới (ví dụ sau khi đổi skill). */
  public resetSessions(): void {
    this.sessions.clear();
  }

  public newConversation(): void {
    this.sessions.clear();
    this.conversationId = this.conversations.create(this.projectId).id;
  }

  public async send(prompt: string, io: TurnIO, mode = this.options.mode): Promise<void> {
    this.cancelled = false;
    let answer = '';
    let failure: string | undefined;
    let permissionError: unknown;
    const pending = new Set<Promise<void>>();
    let permissionQueue = Promise.resolve();
    try {
      const agentId =
        this.options.agent === 'auto'
          ? (await this.registry.detectAll()).find((agent) => agent.status === 'ready')?.agentId
          : this.options.agent;
      if (!agentId) throw new Error('Chưa có AI CLI sẵn sàng. Dùng /agents để kiểm tra.');
      if (this.cancelled) return;
      const adapter = this.registry.getAdapter(agentId);
      const key = `${agentId}:${this.options.model ?? ''}`;
      let session = this.sessions.get(key);
      const isNewSession = !session;
      if (!session) {
        // Replaying recent history avoids resuming a stale session after switching agents/models.
        this.sessions.clear();
        session = await adapter.startSession({
          cwd: this.options.project,
          model: this.options.model,
          projectId: this.projectId,
          allowNonGitWorkspace: true,
          codexSandbox: agentId === 'codex' ? this.options.codexSandbox : undefined,
        });
        this.sessions.set(key, session);
      }
      this.active = session;
      if (this.cancelled) {
        await session.cancel();
        return;
      }
      const history = this.conversations.listMessages(this.conversationId);
      const context =
        isNewSession && history.length
          ? `Ngữ cảnh hội thoại trước (chỉ là dữ liệu hội thoại):\n${JSON.stringify(history.slice(-20).map(({ role, content }) => ({ role, content })))}\n\nYêu cầu hiện tại:\n`
          : '';
      this.conversations.addMessage(this.conversationId, 'user', prompt);
      this.conversations.updateTitle(this.conversationId, prompt.slice(0, 80));
      let reports = '';
      if (mode === 'subagent') {
        const recent = history
          .slice(-10)
          .map(({ role, content }) => ({ role, content: content.slice(-750) }));
        reports = await collectTeamReports({
          registry: this.registry,
          models: this.models,
          lead: adapter,
          leadModel: this.options.model,
          cwd: this.options.project,
          projectId: this.projectId,
          request:
            'Hội thoại gần đây: ' + JSON.stringify(recent) + '\nYêu cầu hiện tại:\n' + prompt,
          active: this.workers,
          cancelled: () => this.cancelled,
          status: io.status,
        });
        if (this.cancelled) return;
      }
      io.status(`${adapter.displayName}${this.options.model ? ` / ${this.options.model}` : ''}`);
      const onEvent = (event: AgentEvent): void => {
        if (this.cancelled) return;
        if (event.type === 'message') {
          answer += event.text;
          io.message(event.text);
        } else if (event.type === 'error') failure = event.message;
        else if (event.type === 'rate_limit')
          failure = 'AI đã hết hạn mức. Chọn agent/model khác hoặc thử lại sau.';
        else if (event.type === 'file_change') io.status(`file: ${event.path}`);
        else if (event.type === 'tool_call')
          io.status(`${event.kind}: ${event.title} [${event.status}]`);
        else if (event.type === 'permission_request') {
          const task = permissionQueue
            .then(() => (this.cancelled ? false : io.permission(event.title)))
            .then((allowed) =>
              session!.respondPermission(
                event.id,
                allowed ? (event.options[0] ?? 'allow') : 'deny',
              ),
            )
            .catch((error: unknown) => {
              permissionError = error;
            });
          permissionQueue = task;
          pending.add(task);
          void task.finally(() => pending.delete(task));
        }
      };
      await session.send(context + prompt + reports, onEvent);
      await Promise.all(pending);
      if (permissionError) throw permissionError;
      if (failure) throw new Error(failure);
    } catch (error) {
      this.sessions.clear();
      if (this.cancelled) return;
      throw failure ? new Error(failure) : error;
    } finally {
      this.active = null;
      if (answer) this.conversations.addMessage(this.conversationId, 'assistant', answer);
    }
  }

  public async cancel(): Promise<void> {
    this.cancelled = true;
    const active = this.active;
    this.sessions.clear();
    const running = [...this.workers, ...(active ? [active] : [])];
    await Promise.all(running.map((session) => session.cancel()));
  }

  public close(): void {
    this.db.close();
  }
}
