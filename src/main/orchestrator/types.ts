import type { AgentId } from '@shared/agents';
import type { DecisionKind } from '../db/decision-repo';

export type PlanStepKind = 'scaffold' | 'feature' | 'styling' | 'fix' | 'refactor' | 'sensitive';

export interface PlanStep {
  readonly seq: number;
  readonly title: string;
  readonly summary: string;
  readonly kind: PlanStepKind;
  readonly requiredTier: 'strong' | 'balanced' | 'fast';
  readonly riskLevel: 'low' | 'medium' | 'high' | null;
  readonly riskTags: readonly string[];
}

export type AiPickOption =
  | { readonly type: 'auto' }
  | { readonly type: 'agent'; readonly agentId: AgentId }
  | { readonly type: 'model'; readonly agentId: AgentId; readonly modelId: string };

export interface SelectedUnit {
  readonly agentId: AgentId;
  readonly agentDisplayName: string;
  readonly agentColor: string;
  readonly modelId: string | null;
  readonly modelLabel: string;
  readonly tier: 'strong' | 'balanced' | 'fast' | 'unknown';
}

export interface RouteContext {
  readonly requiredTier: 'strong' | 'balanced' | 'fast';
  readonly riskLevel: 'low' | 'medium' | 'high' | null;
  readonly aiPick?: AiPickOption;
  readonly enabledAgents?: Readonly<Record<string, boolean>>;
  readonly priorityList?: readonly AgentId[];
  readonly exhaustedUnits?: ReadonlySet<string>; // key dạng "agentId:modelId" hoặc "agentId:*"
  readonly lowQuotaUnits?: ReadonlySet<string>;
}

export interface RouteResult {
  readonly unit: SelectedUnit;
  readonly decisionText: string;
  readonly decisionKind: DecisionKind;
}

export interface OrchestrationEventPayload {
  readonly conversationId: string;
  readonly type:
    | 'step_updated'
    | 'message_added'
    | 'system_line'
    | 'log_entry'
    | 'permission_requested'
    | 'execution_paused'
    | 'execution_done'
    | 'execution_stopped';
  readonly data: unknown;
}

export interface OrchestrationLogEntry {
  readonly at: string;
  readonly source: 'orchestrator' | string;
  readonly text: string;
}

export interface PermissionRequestPayload {
  readonly requestId: string;
  readonly stepId: string;
  readonly agentId: string;
  readonly agentDisplayName: string;
  readonly modelLabel: string;
  readonly kind: 'delete' | 'install' | 'run' | 'network' | 'write_outside';
  readonly title: string;
  readonly explain: string;
  readonly effects: ReadonlyArray<{ readonly tag: string; readonly text: string }>;
  readonly rawCommand?: string;
}

export interface PausedPayload {
  readonly stepId: string;
  readonly stepSeq: number;
  readonly reason: string;
  readonly nextResetTime: string | null;
  readonly availableAlternatives: ReadonlyArray<{
    readonly agentId: string;
    readonly modelId: string;
    readonly label: string;
    readonly tier: string;
  }>;
}

export interface StepSummaryResult {
  readonly summary: string[];
  readonly explain: string[];
  readonly why: string | null;
}
