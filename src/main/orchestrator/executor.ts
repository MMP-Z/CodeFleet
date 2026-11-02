import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { AgentAdapter, AgentEvent, AgentSession } from '../agents/types';
import type { AgentRegistry } from '../agents/detect';
import type { ConversationRepository } from '../db/conversation-repo';
import type { DecisionRepository } from '../db/decision-repo';
import type { Logger } from '../logger/logger';
import { PathGuard } from '../security/path-guard';
import type { QuotaService } from '../quota/quota-service';
import { Router } from './router';
import { Summarizer } from './summarizer';
import type {
  OrchestrationEventPayload,
  OrchestrationLogEntry,
  PermissionRequestPayload,
  PlanStep,
  RouteContext,
  SelectedUnit,
} from './types';

export interface ExecutorOptions {
  readonly projectPath: string;
  readonly conversationId: string;
  readonly steps: readonly PlanStep[];
  readonly context: RouteContext;
  readonly registry: AgentRegistry;
  readonly router: Router;
  readonly convRepo: ConversationRepository;
  readonly decisionRepo: DecisionRepository;
  readonly projectId: string;
  readonly quotaService?: QuotaService;
  readonly logger?: Logger;
}

interface PendingPermission {
  readonly resolve: (allowed: boolean) => void;
}

export class SequentialExecutor extends EventEmitter {
  private readonly projectPath: string;
  private readonly conversationId: string;
  private readonly steps: readonly PlanStep[];
  private readonly context: RouteContext;
  private readonly registry: AgentRegistry;
  private readonly router: Router;
  private readonly convRepo: ConversationRepository;
  private readonly decisionRepo: DecisionRepository;
  private readonly projectId: string;
  private readonly quotaService?: QuotaService;
  private readonly pathGuard: PathGuard;
  private readonly summarizer: Summarizer;
  private readonly logger?: Logger;

  private isCancelled = false;
  private activeSession: AgentSession | null = null;
  private activeStepDbId: string | null = null;
  private readonly pendingPermissions = new Map<string, PendingPermission>();

  public constructor(options: ExecutorOptions) {
    super();
    this.projectPath = options.projectPath;
    this.conversationId = options.conversationId;
    this.steps = options.steps;
    this.context = options.context;
    this.registry = options.registry;
    this.router = options.router;
    this.convRepo = options.convRepo;
    this.decisionRepo = options.decisionRepo;
    this.projectId = options.projectId;
    this.quotaService = options.quotaService;
    this.logger = options.logger;
    this.pathGuard = new PathGuard({ projectRoot: options.projectPath });
    this.summarizer = new Summarizer();
  }

  public async run(): Promise<void> {
    // 1. Tạo các bản ghi steps trong DB
    const createdDbSteps = this.convRepo.createSteps(
      this.conversationId,
      this.steps.map((s) => ({
        seq: s.seq,
        agentId: 'pending',
        status: 'pending',
        summary: s.summary,
        riskLevel: s.riskLevel,
      })),
    );

    for (let i = 0; i < this.steps.length; i++) {
      if (this.isCancelled) {
        this.emitPayload('execution_stopped', { reason: 'User cancelled' });
        return;
      }

      const step = this.steps[i]!;
      const dbStep = createdDbSteps[i]!;
      this.activeStepDbId = dbStep.id;

      const stepSuccess = await this.executeStep(step, dbStep.id);
      if (!stepSuccess) {
        return;
      }
    }

    this.emitPayload('execution_done', { conversationId: this.conversationId });
  }

  public cancel(): void {
    this.isCancelled = true;
    if (this.activeSession) {
      try {
        this.activeSession.cancel();
      } catch (err) {
        this.logger?.warn('Lỗi khi cancel session:', { err });
      }
      this.activeSession = null;
    }

    if (this.activeStepDbId) {
      this.convRepo.updateStepStatus(this.activeStepDbId, 'pending', {
        summary: 'Đã dừng theo yêu cầu của bạn',
      });
      this.emitPayload('step_updated', {
        stepId: this.activeStepDbId,
        status: 'pending',
      });
    }

    // Huỷ các permission đang chờ
    for (const [_, p] of this.pendingPermissions) {
      p.resolve(false);
    }
    this.pendingPermissions.clear();
  }

  public respondPermission(requestId: string, allowed: boolean): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) return false;
    pending.resolve(allowed);
    this.pendingPermissions.delete(requestId);
    return true;
  }

  private async executeStep(step: PlanStep, dbStepId: string): Promise<boolean> {
    // 1. Router chọn ô ban đầu
    const initialRoute = await this.router.selectInitialUnit(step, this.context);
    if (!initialRoute) {
      this.convRepo.updateStepStatus(dbStepId, 'paused');
      this.emitPayload('execution_paused', {
        stepId: dbStepId,
        stepSeq: step.seq,
        reason: 'Không tìm thấy AI hoặc model phù hợp cho bước này',
        nextResetTime: null,
      });
      return false;
    }

    let currentUnit = initialRoute.unit;

    // Ghi nhận quyết định ban đầu
    this.decisionRepo.add({
      projectId: this.projectId,
      stepId: dbStepId,
      kind: initialRoute.decisionKind,
      text: initialRoute.decisionText,
    });

    this.convRepo.updateStepStatus(dbStepId, 'running', {
      agentId: currentUnit.agentId,
      model: currentUnit.modelId,
    });
    this.convRepo.setStepStarted(dbStepId);

    this.emitPayload('step_updated', {
      stepId: dbStepId,
      seq: step.seq,
      agentId: currentUnit.agentId,
      agentDisplayName: currentUnit.agentDisplayName,
      agentColor: currentUnit.agentColor,
      modelLabel: currentUnit.modelLabel,
      status: 'running',
    });

    this.emitLog(currentUnit.agentId, `Bắt đầu bước ${step.seq}: ${step.title}`);

    // Vòng lặp thử chạy (có thể đổi ô nếu gặp rate limit)
    let stepCompleted = false;

    while (!stepCompleted && !this.isCancelled) {
      const adapter = this.registry.get(currentUnit.agentId);
      if (!adapter) {
        this.convRepo.updateStepStatus(dbStepId, 'failed', {
          summary: `Không tìm thấy adapter cho ${currentUnit.agentDisplayName}`,
        });
        return false;
      }

      const runOutcome = await this.runSessionWithAdapter(adapter, currentUnit, step, dbStepId);

      if (runOutcome.outcome === 'success') {
        stepCompleted = true;

        // Lưu các file đã sửa
        if (runOutcome.files.length > 0) {
          this.convRepo.addStepFiles(
            dbStepId,
            runOutcome.files.map((f) => ({
              path: f.path,
              change: f.change,
              riskTags: step.riskTags,
            })),
          );
        }

        // Tóm tắt kết quả
        const summary = this.summarizer.summarize({
          stepTitle: step.title,
          stepSummary: step.summary,
          files: runOutcome.files,
        });

        const finishedAt = new Date().toISOString();
        this.convRepo.updateStepStatus(dbStepId, 'done', {
          summary: summary.summary.join(' '),
          finishedAt,
        });

        this.emitPayload('step_updated', {
          stepId: dbStepId,
          seq: step.seq,
          agentId: currentUnit.agentId,
          agentDisplayName: currentUnit.agentDisplayName,
          agentColor: currentUnit.agentColor,
          modelLabel: currentUnit.modelLabel,
          status: 'done',
          summary: summary.summary.join(' '),
        });

        this.emitLog(
          currentUnit.agentId,
          `Hoàn thành bước ${step.seq}: ${summary.summary[0] ?? step.title}`,
        );
        return true;
      }

      if (runOutcome.outcome === 'rate_limit') {
        // Ghi nhận quota phát hiện lỗi 429 thụ động (ADR-018, PLAN 6.6)
        this.quotaService?.recordDetectedRateLimit(
          currentUnit.agentId,
          currentUnit.modelId,
          new Error(`${currentUnit.agentDisplayName} rate limit encountered`),
        );

        // Chuỗi dự phòng khi Rate Limit (PLAN 4.5a)
        this.emitLog(
          'orchestrator',
          `${currentUnit.agentDisplayName} (${currentUnit.modelLabel}) gặp rate limit. Đang tìm ô thay thế...`,
        );

        const switchResult = await this.router.switchOnRateLimit(step, currentUnit, this.context);

        if (!switchResult) {
          // Không còn ô nào thay thế được → tạm dừng bước
          this.convRepo.updateStepStatus(dbStepId, 'paused');
          this.emitPayload('system_line', {
            text: `Tạm dừng bước ${step.seq}: chưa có AI đủ mạnh còn hạn mức. Bạn có thể quay lại sau để chạy tiếp.`,
            tone: 'warn',
          });
          this.emitPayload('execution_paused', {
            stepId: dbStepId,
            stepSeq: step.seq,
            reason: 'Tất cả các AI và model khả dụng đều đã hết hạn mức cho loại việc này',
            nextResetTime: 'trong vòng 1 giờ tới',
          });
          return false;
        }

        // Đổi sang ô mới thành công!
        currentUnit = switchResult.unit;

        // Ghi đúng 1 dòng decisions (loại 'switch') + phát 1 SystemLine + 1 dòng nhật ký (PLAN 4.5a)
        this.decisionRepo.add({
          projectId: this.projectId,
          stepId: dbStepId,
          kind: 'switch',
          text: switchResult.decisionText,
        });

        this.convRepo.updateStepStatus(dbStepId, 'running', {
          agentId: currentUnit.agentId,
          model: currentUnit.modelId,
        });

        this.emitPayload('system_line', {
          text: switchResult.decisionText,
          tone: 'info',
        });

        this.emitLog('orchestrator', switchResult.decisionText);

        this.emitPayload('step_updated', {
          stepId: dbStepId,
          agentId: currentUnit.agentId,
          agentDisplayName: currentUnit.agentDisplayName,
          agentColor: currentUnit.agentColor,
          modelLabel: currentUnit.modelLabel,
          note: switchResult.decisionText,
        });

        // Vòng lặp while tiếp tục với currentUnit mới
      } else {
        // runOutcome.outcome === 'error' hoặc 'cancelled'
        if (this.isCancelled) return false;

        this.convRepo.updateStepStatus(dbStepId, 'failed', {
          summary: runOutcome.errorMessage ?? 'Không hoàn thành được bước',
        });
        this.emitPayload('step_updated', {
          stepId: dbStepId,
          status: 'failed',
          summary: runOutcome.errorMessage,
        });
        return false;
      }
    }

    return stepCompleted;
  }

  private async runSessionWithAdapter(
    adapter: AgentAdapter,
    unit: SelectedUnit,
    step: PlanStep,
    dbStepId: string,
  ): Promise<{
    readonly outcome: 'success' | 'rate_limit' | 'error' | 'cancelled';
    readonly files: ReadonlyArray<{
      readonly path: string;
      readonly change: 'added' | 'modified' | 'deleted';
    }>;
    readonly errorMessage?: string;
  }> {
    const files: Array<{ path: string; change: 'added' | 'modified' | 'deleted' }> = [];

    return new Promise((resolve) => {
      let isDone = false;

      void adapter
        .startSession({
          cwd: this.projectPath,
          model: unit.modelId ?? undefined,
        })
        .then(async (session) => {
          this.activeSession = session;

          const onEvent = (event: AgentEvent) => {
            if (isDone || this.isCancelled) return;

            switch (event.type) {
              case 'file_change': {
                // Kiểm soát đường dẫn Luật B4
                const isSafe = this.pathGuard.isWithinProject(event.path);
                if (!isSafe) {
                  this.emitLog(
                    'orchestrator',
                    `[BẢO MẬT B4] Đã chặn ghi ra ngoài dự án: ${event.path}`,
                  );
                  this.emitPayload('system_line', {
                    text: `Đã chặn AI ghi ra ngoài thư mục dự án (${path.basename(event.path)}) theo Luật B4.`,
                    tone: 'warn',
                  });
                  return;
                }

                files.push({
                  path: event.path,
                  change: 'modified',
                });
                this.emitLog(unit.agentId, `Thay đổi file: ${event.path}`);
                break;
              }

              case 'permission_request': {
                // Xin phép theo Luật B5
                const reqId = event.id;
                this.convRepo.updateStepStatus(dbStepId, 'waiting_permission');
                this.emitPayload('step_updated', {
                  stepId: dbStepId,
                  status: 'waiting_permission',
                });

                const payload: PermissionRequestPayload = {
                  requestId: reqId,
                  stepId: dbStepId,
                  agentId: unit.agentId,
                  agentDisplayName: unit.agentDisplayName,
                  modelLabel: unit.modelLabel,
                  kind: 'run',
                  title: event.title,
                  explain: `AI muốn thực hiện hành động: ${event.title}`,
                  effects: [{ tag: 'Chạy lệnh', text: event.title }],
                };

                this.emitPayload('permission_requested', payload);

                new Promise<boolean>((res) => {
                  this.pendingPermissions.set(reqId, { resolve: res });
                }).then((allowed) => {
                  this.convRepo.updateStepStatus(dbStepId, 'running');
                  this.emitPayload('step_updated', {
                    stepId: dbStepId,
                    status: 'running',
                  });

                  const selectedOption = allowed ? (event.options[0] ?? 'allow') : 'deny';
                  if (allowed) {
                    this.emitLog(unit.agentId, `Bạn đã cho phép thực hiện: ${event.title}`);
                  } else {
                    this.emitLog(
                      unit.agentId,
                      `Bạn đã từ chối thực hiện: ${event.title}. Đang yêu cầu AI tìm cách khác.`,
                    );
                  }
                  void session.respondPermission(reqId, selectedOption);
                });
                break;
              }

              case 'rate_limit': {
                isDone = true;
                resolve({ outcome: 'rate_limit', files });
                break;
              }

              case 'done': {
                isDone = true;
                resolve({ outcome: 'success', files });
                break;
              }

              case 'error': {
                isDone = true;
                resolve({
                  outcome: 'error',
                  files,
                  errorMessage: event.message,
                });
                break;
              }
            }
          };

          const prompt = `Thực hiện bước ${step.seq}: ${step.title}. Nội dung công việc: ${step.summary}`;
          await session.send(prompt, onEvent);
        })
        .catch((err: Error) => {
          resolve({
            outcome: 'error',
            files,
            errorMessage: err.message,
          });
        });
    });
  }

  private emitPayload(type: OrchestrationEventPayload['type'], data: unknown): void {
    const payload: OrchestrationEventPayload = {
      conversationId: this.conversationId,
      type,
      data,
    };
    this.emit('event', payload);
  }

  private emitLog(source: string, text: string): void {
    const entry: OrchestrationLogEntry = {
      at: new Date().toISOString(),
      source,
      text,
    };
    this.emitPayload('log_entry', entry);
  }
}
