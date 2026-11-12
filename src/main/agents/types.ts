import type {
  CliStatus,
  DetectResult,
  EditableModelTier,
  ModelInfo,
  ModelRef,
  ModelTier,
  QuotaSnapshot,
  TierSource,
} from '@shared/agents';

export type BuiltinAgentId = 'claude' | 'codex' | 'copilot' | 'agy';
export type AgentId = BuiltinAgentId | (string & {});

export type {
  CliStatus,
  DetectResult,
  EditableModelTier,
  ModelInfo,
  ModelRef,
  ModelTier,
  QuotaSnapshot,
  TierSource,
};

export interface DiscoveredModel {
  id: string;
  label: string;
}

export interface AgentPlanStep {
  title: string;
  status: string;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AgentEvent =
  | { type: 'message'; text: string }
  | { type: 'plan'; steps: AgentPlanStep[] }
  | { type: 'tool_call'; id: string; kind: string; title: string; status: string }
  | { type: 'file_change'; path: string; diff?: string }
  | { type: 'permission_request'; id: string; title: string; options: string[] }
  | { type: 'rate_limit'; resetsAt?: string; model?: string }
  | { type: 'done'; externalSessionId?: string; usage?: AgentUsage }
  | { type: 'error'; message: string };

export type PermissionHandler = (request: {
  id: string;
  title: string;
  options: string[];
}) => Promise<string>;

export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface StartSessionOptions {
  cwd: string;
  projectId?: string;
  model?: string | null;
  resumeId?: string;
  allowNonGitWorkspace?: boolean;
  readOnly?: boolean;
  codexSandbox?: CodexSandboxMode;
  onPermissionRequest?: PermissionHandler;
}

export interface AgentSession {
  readonly id: string;
  readonly agentId: AgentId;
  readonly cwd: string;
  readonly model: string | null;
  getExternalSessionId(): string | null;
  send(prompt: string, onEvent: (e: AgentEvent) => void): Promise<void>;
  respondPermission(requestId: string, optionId: string): Promise<void>;
  cancel(): Promise<void>;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly displayName: string;
  readonly shortName: string;
  readonly logoLetter: string;
  readonly color: string;
  readonly darkColor: string;
  readonly docsUrl: string;
  readonly installCommand: string;
  readonly loginCommand: string;
  detect(): Promise<DetectResult>;
  listModels(): Promise<ModelInfo[]>;
  startSession(opts: StartSessionOptions): Promise<AgentSession>;
  getQuota(model?: string): Promise<QuotaSnapshot[]>;
}
