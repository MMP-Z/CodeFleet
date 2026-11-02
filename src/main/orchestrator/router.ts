import type { ModelInfo } from '@shared/agents';
import type { AgentRegistry } from '../agents/detect';
import type { ModelTierService } from '../agents/models';
import type { PlanStep, RouteContext, RouteResult, SelectedUnit } from './types';

export class Router {
  private readonly registry: AgentRegistry;
  private readonly modelService: ModelTierService;

  public constructor(registry: AgentRegistry, modelService: ModelTierService) {
    this.registry = registry;
    this.modelService = modelService;
  }

  /**
   * Chọn ô (CLI, model) ban đầu cho một bước công việc.
   */
  public async selectInitialUnit(
    step: PlanStep,
    context: RouteContext,
  ): Promise<RouteResult | null> {
    const candidates = await this.getCandidateUnits(context);

    if (candidates.length === 0) {
      return null;
    }

    // 1. Nếu người dùng ghim model cụ thể
    if (context.aiPick?.type === 'model') {
      const targetAgent = context.aiPick.agentId;
      const targetModel = context.aiPick.modelId;
      const pinned = candidates.find((c) => c.agentId === targetAgent && c.modelId === targetModel);
      if (pinned && !this.isExhausted(pinned, context)) {
        return {
          unit: pinned,
          decisionKind: 'pick',
          decisionText: `Chọn ${pinned.agentDisplayName} (${pinned.modelLabel}) theo cấu hình ghim của bạn`,
        };
      }
    }

    // 2. Nếu người dùng ghim cả CLI
    if (context.aiPick?.type === 'agent') {
      const targetAgent = context.aiPick.agentId;
      const filtered = candidates.filter((c) => c.agentId === targetAgent);
      const matched = this.matchTier(filtered, step.requiredTier, step.riskLevel, context);
      if (matched) {
        return {
          unit: matched,
          decisionKind: 'pick',
          decisionText: `Chọn ${matched.agentDisplayName} (${matched.modelLabel}) theo CLI bạn đã ghim`,
        };
      }
    }

    // 3. Chế độ Tự chọn (khuyên dùng)
    const selected = this.matchTier(candidates, step.requiredTier, step.riskLevel, context);
    if (!selected) {
      return null;
    }

    const tierDesc =
      selected.tier === 'strong'
        ? 'mạnh'
        : selected.tier === 'balanced'
          ? 'cân bằng'
          : 'nhanh và tiết kiệm';

    return {
      unit: selected,
      decisionKind: 'pick',
      decisionText: `Chọn ${selected.agentDisplayName} (${selected.modelLabel}) vì bước này cần model bậc ${tierDesc}`,
    };
  }

  /**
   * Chuỗi dự phòng khi gặp rate limit theo PLAN mục 4.5a:
   * 1. Model khác cùng CLI (nếu đủ bậc; bước nhạy cảm KHÔNG hạ bậc).
   * 2. CLI khác có model đạt bậc yêu cầu và còn hạn mức.
   * 3. Không còn ô nào: trả về null để tạm dừng.
   */
  public async switchOnRateLimit(
    step: PlanStep,
    currentUnit: SelectedUnit,
    context: RouteContext,
  ): Promise<RouteResult | null> {
    const candidates = await this.getCandidateUnits(context);

    // Thêm currentUnit vào danh sách đã exhausted
    const updatedExhausted = new Set(context.exhaustedUnits ?? []);
    updatedExhausted.add(`${currentUnit.agentId}:${currentUnit.modelId}`);

    const updatedContext: RouteContext = {
      ...context,
      exhaustedUnits: updatedExhausted,
    };

    // 1. Thử model khác cùng CLI
    const sameAgentCandidates = candidates.filter(
      (c) =>
        c.agentId === currentUnit.agentId &&
        c.modelId !== currentUnit.modelId &&
        !this.isExhausted(c, updatedContext),
    );

    const sameAgentMatch = this.matchTier(
      sameAgentCandidates,
      step.requiredTier,
      step.riskLevel,
      updatedContext,
    );

    if (sameAgentMatch) {
      return {
        unit: sameAgentMatch,
        decisionKind: 'switch',
        decisionText: `${currentUnit.modelLabel} hết hạn mức, chuyển sang model ${sameAgentMatch.modelLabel} cùng của ${sameAgentMatch.agentDisplayName}`,
      };
    }

    // 2. Thử CLI khác có model đạt bậc yêu cầu
    const otherAgentCandidates = candidates.filter(
      (c) => c.agentId !== currentUnit.agentId && !this.isExhausted(c, updatedContext),
    );

    const otherAgentMatch = this.matchTier(
      otherAgentCandidates,
      step.requiredTier,
      step.riskLevel,
      updatedContext,
    );

    if (otherAgentMatch) {
      const sensitiveNotice =
        step.riskLevel === 'high'
          ? `Bước ${step.seq} nhạy cảm nên không hạ bậc model, app chuyển sang`
          : `chuyển sang`;

      return {
        unit: otherAgentMatch,
        decisionKind: 'switch',
        decisionText: `${currentUnit.agentDisplayName} (${currentUnit.modelLabel}) đã hết hạn mức. ${sensitiveNotice} ${otherAgentMatch.agentDisplayName} (${otherAgentMatch.modelLabel})`,
      };
    }

    // 3. Không còn ô nào khả dụng
    return null;
  }

  private isExhausted(unit: SelectedUnit, context: RouteContext): boolean {
    const keyExact = `${unit.agentId}:${unit.modelId}`;
    const keyShared = `${unit.agentId}:*`;
    return Boolean(context.exhaustedUnits?.has(keyExact) || context.exhaustedUnits?.has(keyShared));
  }

  private matchTier(
    units: readonly SelectedUnit[],
    requiredTier: 'strong' | 'balanced' | 'fast',
    riskLevel: 'low' | 'medium' | 'high' | null,
    context: RouteContext,
  ): SelectedUnit | null {
    const available = units.filter((u) => !this.isExhausted(u, context));
    if (available.length === 0) return null;

    // Không hạ bậc nếu bước rủi ro cao (PLAN 4.5a)
    if (riskLevel === 'high') {
      const strongOnly = available.filter((u) => u.tier === 'strong');
      return this.pickBestCandidate(strongOnly, context);
    }

    // Phân loại ứng viên theo bậc
    if (requiredTier === 'strong') {
      const strong = available.filter((u) => u.tier === 'strong');
      if (strong.length > 0) return this.pickBestCandidate(strong, context);
      return null;
    }

    if (requiredTier === 'balanced') {
      const balanced = available.filter((u) => u.tier === 'balanced');
      if (balanced.length > 0) return this.pickBestCandidate(balanced, context);

      const strongFallback = available.filter((u) => u.tier === 'strong');
      if (strongFallback.length > 0) return this.pickBestCandidate(strongFallback, context);

      const fastFallback = available.filter((u) => u.tier === 'fast');
      if (fastFallback.length > 0) return this.pickBestCandidate(fastFallback, context);
      return null;
    }

    // requiredTier === 'fast'
    const fast = available.filter((u) => u.tier === 'fast');
    if (fast.length > 0) return this.pickBestCandidate(fast, context);

    const balancedFallback = available.filter((u) => u.tier === 'balanced');
    if (balancedFallback.length > 0) return this.pickBestCandidate(balancedFallback, context);

    const strongFallback = available.filter((u) => u.tier === 'strong');
    if (strongFallback.length > 0) return this.pickBestCandidate(strongFallback, context);

    return null;
  }

  private pickBestCandidate(
    candidates: readonly SelectedUnit[],
    context: RouteContext,
  ): SelectedUnit | null {
    if (candidates.length === 0) return null;

    // Sắp xếp: ưu tiên không bị low quota trước, sau đó theo priorityList
    const priority = context.priorityList ?? ['claude', 'copilot', 'codex', 'agy'];

    const sorted = [...candidates].sort((a, b) => {
      const aIsLow = context.lowQuotaUnits?.has(`${a.agentId}:${a.modelId}`) ? 1 : 0;
      const bIsLow = context.lowQuotaUnits?.has(`${b.agentId}:${b.modelId}`) ? 1 : 0;
      if (aIsLow !== bIsLow) return aIsLow - bIsLow;

      const aPrio = priority.indexOf(a.agentId);
      const bPrio = priority.indexOf(b.agentId);
      const aIndex = aPrio === -1 ? 99 : aPrio;
      const bIndex = bPrio === -1 ? 99 : bPrio;
      return aIndex - bIndex;
    });

    return sorted[0] ?? null;
  }

  private async getCandidateUnits(context: RouteContext): Promise<SelectedUnit[]> {
    const detectResults = await this.registry.detectAll();
    const readyAgents = detectResults.filter(
      (a) => a.installed && a.loggedIn && (context.enabledAgents?.[a.agentId] ?? true),
    );

    const result: SelectedUnit[] = [];

    for (const agent of readyAgents) {
      const adapter = this.registry.get(agent.agentId);
      let models: ModelInfo[] = [];

      if (adapter) {
        try {
          const rawModels = await adapter.listModels();
          models = this.modelService.syncAgentModels(agent.agentId, rawModels);
        } catch {
          models = this.modelService.listModels(agent.agentId);
        }
      } else {
        models = this.modelService.listModels(agent.agentId);
      }

      for (const m of models) {
        result.push({
          agentId: agent.agentId,
          agentDisplayName: agent.displayName,
          agentColor: agent.color,
          modelId: m.id,
          modelLabel: m.label,
          tier: m.tier,
        });
      }

      // Nếu agent không báo model nào cụ thể, cho phép model = null (chế độ tự động của CLI)
      if (models.length === 0) {
        result.push({
          agentId: agent.agentId,
          agentDisplayName: agent.displayName,
          agentColor: agent.color,
          modelId: null,
          modelLabel: `${agent.shortName} Auto`,
          tier: 'balanced',
        });
      }
    }

    return result;
  }
}
