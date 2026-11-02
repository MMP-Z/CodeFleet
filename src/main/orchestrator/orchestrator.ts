import { EventEmitter } from 'node:events';
import type { AgentRegistry } from '../agents/detect';
import type { ModelTierService } from '../agents/models';
import type { ConversationRepository } from '../db/conversation-repo';
import type { DecisionRepository } from '../db/decision-repo';
import type { ProjectRepository } from '../db/project-repo';
import type { SettingsRepository } from '../db/settings-repo';
import type { Logger } from '../logger/logger';
import type { QuotaService } from '../quota/quota-service';
import { SequentialExecutor } from './executor';
import { Planner } from './planner';
import { Router } from './router';
import type { AiPickOption, OrchestrationEventPayload, PlanStep, RouteContext } from './types';

export interface OrchestratorOptions {
  readonly registry: AgentRegistry;
  readonly modelService: ModelTierService;
  readonly convRepo: ConversationRepository;
  readonly projRepo: ProjectRepository;
  readonly decisionRepo: DecisionRepository;
  readonly settingsRepo?: SettingsRepository;
  readonly quotaService?: QuotaService;
  readonly logger?: Logger;
}

export class Orchestrator extends EventEmitter {
  private readonly registry: AgentRegistry;
  private readonly modelService: ModelTierService;
  private readonly convRepo: ConversationRepository;
  private readonly projRepo: ProjectRepository;
  private readonly decisionRepo: DecisionRepository;
  private readonly settingsRepo?: SettingsRepository;
  private readonly quotaService?: QuotaService;
  private readonly logger?: Logger;

  private readonly planner: Planner;
  private readonly router: Router;
  private readonly activeExecutors = new Map<string, SequentialExecutor>();
  private readonly aiPicks = new Map<string, AiPickOption>();

  public constructor(options: OrchestratorOptions) {
    super();
    this.registry = options.registry;
    this.modelService = options.modelService;
    this.convRepo = options.convRepo;
    this.projRepo = options.projRepo;
    this.decisionRepo = options.decisionRepo;
    this.settingsRepo = options.settingsRepo;
    this.quotaService = options.quotaService;
    this.logger = options.logger;

    this.planner = new Planner();
    this.router = new Router(this.registry, this.modelService);
  }

  public setAiPick(conversationId: string, pick: AiPickOption): void {
    this.aiPicks.set(conversationId, pick);
  }

  public getAiPick(conversationId: string): AiPickOption {
    return this.aiPicks.get(conversationId) ?? { type: 'auto' };
  }

  public async send(input: {
    readonly conversationId: string;
    readonly prompt: string;
    readonly aiPick?: AiPickOption;
  }): Promise<{ readonly steps: readonly PlanStep[] }> {
    const { conversationId, prompt } = input;

    // Lưu ghim nếu có truyền vào
    if (input.aiPick) {
      this.setAiPick(conversationId, input.aiPick);
    }
    const currentAiPick = this.getAiPick(conversationId);

    // 1. Kiểm tra conversation và project
    const conv = this.convRepo.getById(conversationId);
    if (!conv) {
      throw new Error(`Không tìm thấy cuộc hội thoại với id: ${conversationId}`);
    }

    const project = this.projRepo.getById(conv.projectId);
    if (!project) {
      throw new Error(`Không tìm thấy dự án với id: ${conv.projectId}`);
    }

    // Cập nhật thời điểm mở dự án
    this.projRepo.touchLastOpened(project.id);

    // 2. Lưu tin nhắn người dùng vào DB
    const userMsg = this.convRepo.addMessage(conversationId, 'user', prompt);
    this.emitEvent('message_added', conversationId, userMsg);

    // Cập nhật tiêu đề cuộc hội thoại nếu chưa có
    if (!conv.title || conv.title === 'Hội thoại mới' || conv.title === '') {
      const autoTitle = prompt.length > 30 ? `${prompt.slice(0, 30)}...` : prompt;
      this.convRepo.updateTitle(conversationId, autoTitle);
    }

    // 3. Lập kế hoạch qua Planner
    this.emitEvent('log_entry', conversationId, {
      at: new Date().toISOString(),
      source: 'orchestrator',
      text: 'Đang phân tích yêu cầu và lập kế hoạch thực hiện...',
    });

    const steps = await this.planner.plan(prompt, {
      projectPath: project.path,
    });

    // Lưu tin nhắn trợ lý phản hồi
    const assistantIntro = `Tôi đã lập kế hoạch gồm ${steps.length} bước để thực hiện yêu cầu của bạn.`;
    const asstMsg = this.convRepo.addMessage(conversationId, 'assistant', assistantIntro);
    this.emitEvent('message_added', conversationId, asstMsg);

    // 4. Chuẩn bị ngữ cảnh điều phối
    const enabledAgentsSetting = this.settingsRepo?.get('agents.enabled');
    const enabledAgents =
      typeof enabledAgentsSetting === 'object' && enabledAgentsSetting !== null
        ? (enabledAgentsSetting as Record<string, boolean>)
        : {};

    const quotaInfo = this.quotaService?.getRouteQuotaInfo();
    const routeContext: RouteContext = {
      requiredTier: 'balanced',
      riskLevel: 'low',
      aiPick: currentAiPick,
      enabledAgents,
      exhaustedUnits: quotaInfo?.exhaustedUnits,
      lowQuotaUnits: quotaInfo?.lowQuotaUnits,
    };

    // 5. Khởi tạo và chạy SequentialExecutor
    const executor = new SequentialExecutor({
      projectPath: project.path,
      conversationId,
      steps,
      context: routeContext,
      registry: this.registry,
      router: this.router,
      convRepo: this.convRepo,
      decisionRepo: this.decisionRepo,
      projectId: project.id,
      quotaService: this.quotaService,
      logger: this.logger,
    });

    this.activeExecutors.set(conversationId, executor);

    executor.on('event', (payload: OrchestrationEventPayload) => {
      this.emit('event', payload);
    });

    // Chạy bất đồng bộ trong background
    void executor
      .run()
      .catch((err: Error) => {
        this.logger?.error('Lỗi khi thực thi executor:', { err });
        this.emitEvent('log_entry', conversationId, {
          at: new Date().toISOString(),
          source: 'orchestrator',
          text: `Lỗi trong quá trình điều phối: ${err.message}`,
        });
      })
      .finally(() => {
        this.activeExecutors.delete(conversationId);
      });

    return { steps };
  }

  public cancel(conversationId: string): void {
    const executor = this.activeExecutors.get(conversationId);
    if (executor) {
      executor.cancel();
      this.activeExecutors.delete(conversationId);
      this.emitEvent('system_line', conversationId, {
        text: 'Đã dừng công việc theo yêu cầu của bạn.',
        tone: 'neutral',
      });
    }
  }

  public respondPermission(conversationId: string, requestId: string, allowed: boolean): boolean {
    const executor = this.activeExecutors.get(conversationId);
    if (executor) {
      return executor.respondPermission(requestId, allowed);
    }
    return false;
  }

  private emitEvent(
    type: OrchestrationEventPayload['type'],
    conversationId: string,
    data: unknown,
  ): void {
    const payload: OrchestrationEventPayload = {
      conversationId,
      type,
      data,
    };
    this.emit('event', payload);
  }
}
