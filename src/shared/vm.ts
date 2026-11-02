import type { AgentId } from './agents';

export type StepUiStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'undone'
  | 'waiting_permission'
  | 'conflict'
  | 'paused';

export interface StepVM {
  readonly id: string;
  readonly seq: number;
  readonly title: string;
  readonly agentId: AgentId;
  readonly agentLabel: string;
  readonly agentColor: string;
  readonly modelLabel: string | null;
  readonly status: StepUiStatus;
  readonly note: string | null;
  readonly riskLevel: 'low' | 'medium' | 'high' | null;
  readonly riskText: string | null;
  readonly hasCode: boolean;
}

export interface StepCodeVM {
  readonly stepId: string;
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly change: 'added' | 'modified' | 'deleted';
    readonly riskTags: readonly string[];
  }>;
  readonly summary: readonly string[];
  readonly keyDiff: {
    readonly file: string;
    readonly lines: ReadonlyArray<{ readonly sign: '+' | '-' | ' '; readonly text: string }>;
  } | null;
  readonly explain: readonly string[];
  readonly why: string | null;
  readonly canUndo: boolean;
}

export interface QuotaChipVM {
  readonly agentId: AgentId;
  readonly label: string;
  readonly color: string;
  readonly text: string;
  readonly tone: 'ok' | 'low' | 'exhausted' | 'unknown';
}

export interface OrchestrationLogEntry {
  readonly at: string;
  readonly source: 'orchestrator' | string;
  readonly text: string;
}

export interface ProjectPathValidation {
  readonly exists: boolean;
  readonly isEmpty: boolean;
  readonly isWritable: boolean;
  readonly hasUserGit: boolean;
  readonly errorDetail: string | null;
}
