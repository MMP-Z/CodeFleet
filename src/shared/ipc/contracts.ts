import { z } from 'zod';
import {
  AgentIdSchema,
  DetectResultSchema,
  EditableModelTierSchema,
  ModelInfoSchema,
  type AgentId,
  type DetectResult,
  type EditableModelTier,
  type ModelInfo,
} from '../agents';
export type { AgentId, DetectResult, EditableModelTier, ModelInfo };
export { AgentIdSchema, DetectResultSchema, EditableModelTierSchema, ModelInfoSchema };
import { APP_NAME, APP_VERSION } from '../constants';
import type { FeatureFlags } from '../feature-flags';
import {
  AppSettingsMapSchema,
  CodeLevelSchema,
  LocaleSchema,
  SettingKeySchema,
  type AppSettingsMap,
  type SettingKey,
} from '../settings';

/**
 * Hợp đồng IPC có kiểu + Zod schema cho cả dữ liệu vào và ra (Luật P3, UI_SPEC mục 7).
 */

export const IPC_CHANNELS = {
  SETTINGS_GET: 'settings.get',
  SETTINGS_GET_ALL: 'settings.getAll',
  SETTINGS_SET: 'settings.set',
  SYSTEM_CHECK_GIT: 'system.checkGit',
  SYSTEM_GET_DATA_INFO: 'system.getDataInfo',
  SYSTEM_OPEN_DATA_DIR: 'system.openDataDir',
  SYSTEM_BACKUP_NOW: 'system.backupNow',
  AGENTS_DETECT_ALL: 'agents.detectAll',
  AGENTS_OPEN_LOGIN: 'agents.openLogin',
  AGENTS_OPEN_DOCS: 'agents.openDocs',
  MODELS_LIST: 'models.list',
  MODELS_SET_TIER: 'models.setTier',
  PROJECTS_LIST: 'projects.list',
  PROJECTS_GET: 'projects.get',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_OPEN: 'projects.open',
  PROJECTS_VALIDATE_PATH: 'projects.validatePath',
  PROJECTS_PICK_FOLDER: 'projects.pickFolder',
  CONVERSATIONS_LIST: 'conversations.list',
  CONVERSATIONS_GET: 'conversations.get',
  CONVERSATIONS_CREATE: 'conversations.create',
  CONVERSATIONS_MESSAGES: 'conversations.messages',
  CONVERSATIONS_STEPS: 'conversations.steps',
  ORCHESTRATOR_SEND: 'orchestrator.send',
  ORCHESTRATOR_CANCEL: 'orchestrator.cancel',
  ORCHESTRATOR_SET_AI_PICK: 'orchestrator.setAiPick',
  PERMISSION_RESPOND: 'permission.respond',
} as const;

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const SettingGetInputSchema = z.object({
  key: SettingKeySchema,
});
export type SettingGetInput = z.infer<typeof SettingGetInputSchema>;

export const SettingValueSchema = z.union([
  LocaleSchema,
  CodeLevelSchema,
  z.boolean(),
  z.record(z.string(), z.boolean()),
]);
export type SettingValue = z.infer<typeof SettingValueSchema>;

export const SettingSetInputSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('ui.locale'), value: LocaleSchema }),
  z.object({ key: z.literal('ui.codeLevel'), value: CodeLevelSchema }),
  z.object({ key: z.literal('ui.showJargon'), value: z.boolean() }),
  z.object({ key: z.literal('ui.autoPreview'), value: z.boolean() }),
  z.object({
    key: z.literal('agents.enabled'),
    value: z.record(z.string(), z.boolean()),
  }),
  z.object({ key: z.literal('onboarding.completed'), value: z.boolean() }),
]);
export type SettingSetInput = z.infer<typeof SettingSetInputSchema>;

export const EmptyInputSchema = z.undefined();

export const GitCheckOutputSchema = z.object({
  available: z.boolean(),
  version: z.string().nullable(),
});
export type GitCheckOutput = z.infer<typeof GitCheckOutputSchema>;

export const DataInfoOutputSchema = z.object({
  userDataDir: z.string(),
  dbPath: z.string(),
  logFilePath: z.string(),
});
export type DataInfoOutput = z.infer<typeof DataInfoOutputSchema>;

export const OpenDataDirOutputSchema = z.object({
  opened: z.boolean(),
  error: z.string().nullable(),
});
export type OpenDataDirOutput = z.infer<typeof OpenDataDirOutputSchema>;

export const BackupNowOutputSchema = z.object({
  backupPath: z.string(),
  createdAt: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type BackupNowOutput = z.infer<typeof BackupNowOutputSchema>;

export const AgentOpenLoginInputSchema = z.object({
  agentId: AgentIdSchema,
});
export type AgentOpenLoginInput = z.infer<typeof AgentOpenLoginInputSchema>;

export const AgentOpenDocsInputSchema = z.object({
  agentId: AgentIdSchema,
});
export type AgentOpenDocsInput = z.infer<typeof AgentOpenDocsInputSchema>;

export const ModelListInputSchema = z.object({
  agentId: AgentIdSchema.optional(),
});
export type ModelListInput = z.infer<typeof ModelListInputSchema>;

export const ModelSetTierInputSchema = z.object({
  agentId: AgentIdSchema,
  modelId: z.string().min(1),
  tier: EditableModelTierSchema,
});
export type ModelSetTierInput = z.infer<typeof ModelSetTierInputSchema>;

// === PHASE 3: DỰ ÁN (PROJECTS) ===

export const ProjectRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  createdAt: z.string().min(1),
  lastOpened: z.string().nullable(),
});
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export const ProjectRecordListSchema = z.array(ProjectRecordSchema);

export const ProjectPathValidationSchema = z.object({
  exists: z.boolean(),
  isEmpty: z.boolean(),
  isWritable: z.boolean(),
  hasUserGit: z.boolean(),
  errorDetail: z.string().nullable(),
});
export type ProjectPathValidation = z.infer<typeof ProjectPathValidationSchema>;

export const ProjectCreateInputSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
});
export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>;

export const ProjectValidatePathInputSchema = z.object({
  path: z.string().min(1),
});
export type ProjectValidatePathInput = z.infer<typeof ProjectValidatePathInputSchema>;

export const ProjectIdInputSchema = z.object({
  id: z.string().min(1),
});
export type ProjectIdInput = z.infer<typeof ProjectIdInputSchema>;

export const ProjectPickFolderOutputSchema = z.object({
  canceled: z.boolean(),
  folderPath: z.string().nullable(),
});
export type ProjectPickFolderOutput = z.infer<typeof ProjectPickFolderOutputSchema>;

// === PHASE 3: HỘI THOẠI (CONVERSATIONS) ===

export const ConversationRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().nullable(),
  createdAt: z.string().min(1),
});
export type ConversationRecord = z.infer<typeof ConversationRecordSchema>;
export const ConversationRecordListSchema = z.array(ConversationRecordSchema);

export const ConversationListInputSchema = z.object({
  projectId: z.string().min(1),
});
export type ConversationListInput = z.infer<typeof ConversationListInputSchema>;

export const ConversationIdInputSchema = z.object({
  id: z.string().min(1),
});
export type ConversationIdInput = z.infer<typeof ConversationIdInputSchema>;

export const ConversationCreateInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().nullable().optional(),
});
export type ConversationCreateInput = z.infer<typeof ConversationCreateInputSchema>;

export const MessageRecordSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string().min(1),
});
export type MessageRecord = z.infer<typeof MessageRecordSchema>;
export const MessageRecordListSchema = z.array(MessageRecordSchema);

export const ConversationTargetInputSchema = z.object({
  conversationId: z.string().min(1),
});
export type ConversationTargetInput = z.infer<typeof ConversationTargetInputSchema>;

export const StepUiStatusSchema = z.enum([
  'pending',
  'running',
  'done',
  'failed',
  'undone',
  'waiting_permission',
  'conflict',
  'paused',
]);

export const StepVMSchema = z.object({
  id: z.string().min(1),
  seq: z.number().int(),
  title: z.string(),
  agentId: AgentIdSchema,
  agentLabel: z.string(),
  agentColor: z.string(),
  modelLabel: z.string().nullable(),
  status: StepUiStatusSchema,
  note: z.string().nullable(),
  riskLevel: z.enum(['low', 'medium', 'high']).nullable(),
  riskText: z.string().nullable(),
  hasCode: z.boolean(),
});
export type StepVM = z.infer<typeof StepVMSchema>;
export const StepVMListSchema = z.array(StepVMSchema);

// === PHASE 3: ĐIỀU PHỐI (ORCHESTRATOR) ===

export const AiPickOptionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('agent'), agentId: AgentIdSchema }),
  z.object({ type: z.literal('model'), agentId: AgentIdSchema, modelId: z.string().min(1) }),
]);
export type AiPickOption = z.infer<typeof AiPickOptionSchema>;

export const OrchestratorSendInputSchema = z.object({
  conversationId: z.string().min(1),
  prompt: z.string().min(1),
  aiPick: AiPickOptionSchema.optional(),
});
export type OrchestratorSendInput = z.infer<typeof OrchestratorSendInputSchema>;

export const OrchestratorSetAiPickInputSchema = z.object({
  conversationId: z.string().min(1),
  aiPick: AiPickOptionSchema,
});
export type OrchestratorSetAiPickInput = z.infer<typeof OrchestratorSetAiPickInputSchema>;

export const PermissionRespondInputSchema = z.object({
  conversationId: z.string().min(1),
  requestId: z.string().min(1),
  allowed: z.boolean(),
});
export type PermissionRespondInput = z.infer<typeof PermissionRespondInputSchema>;

export const OrchestrationSendOutputSchema = z.object({
  started: z.boolean(),
});
export type OrchestrationSendOutput = z.infer<typeof OrchestrationSendOutputSchema>;

export const OrchestrationEventPayloadSchema = z.object({
  conversationId: z.string().min(1),
  type: z.enum([
    'step_updated',
    'message_added',
    'system_line',
    'log_entry',
    'permission_requested',
    'execution_paused',
    'execution_done',
    'execution_stopped',
  ]),
  data: z.unknown(),
});
export type OrchestrationEventPayload = z.infer<typeof OrchestrationEventPayloadSchema>;

export const DetectResultListSchema = z.array(DetectResultSchema);
export const ModelInfoListSchema = z.array(ModelInfoSchema);
export const VoidOutputSchema = z.void();

export interface IpcContract<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  readonly channel: IpcChannelName;
  readonly input: I;
  readonly output: O;
}

export const IPC_CONTRACTS = {
  [IPC_CHANNELS.SETTINGS_GET]: {
    channel: IPC_CHANNELS.SETTINGS_GET,
    input: SettingGetInputSchema,
    output: SettingValueSchema,
  },
  [IPC_CHANNELS.SETTINGS_GET_ALL]: {
    channel: IPC_CHANNELS.SETTINGS_GET_ALL,
    input: EmptyInputSchema,
    output: AppSettingsMapSchema,
  },
  [IPC_CHANNELS.SETTINGS_SET]: {
    channel: IPC_CHANNELS.SETTINGS_SET,
    input: SettingSetInputSchema,
    output: AppSettingsMapSchema,
  },
  [IPC_CHANNELS.SYSTEM_CHECK_GIT]: {
    channel: IPC_CHANNELS.SYSTEM_CHECK_GIT,
    input: EmptyInputSchema,
    output: GitCheckOutputSchema,
  },
  [IPC_CHANNELS.SYSTEM_GET_DATA_INFO]: {
    channel: IPC_CHANNELS.SYSTEM_GET_DATA_INFO,
    input: EmptyInputSchema,
    output: DataInfoOutputSchema,
  },
  [IPC_CHANNELS.SYSTEM_OPEN_DATA_DIR]: {
    channel: IPC_CHANNELS.SYSTEM_OPEN_DATA_DIR,
    input: EmptyInputSchema,
    output: OpenDataDirOutputSchema,
  },
  [IPC_CHANNELS.SYSTEM_BACKUP_NOW]: {
    channel: IPC_CHANNELS.SYSTEM_BACKUP_NOW,
    input: EmptyInputSchema,
    output: BackupNowOutputSchema,
  },
  [IPC_CHANNELS.AGENTS_DETECT_ALL]: {
    channel: IPC_CHANNELS.AGENTS_DETECT_ALL,
    input: EmptyInputSchema,
    output: DetectResultListSchema,
  },
  [IPC_CHANNELS.AGENTS_OPEN_LOGIN]: {
    channel: IPC_CHANNELS.AGENTS_OPEN_LOGIN,
    input: AgentOpenLoginInputSchema,
    output: VoidOutputSchema,
  },
  [IPC_CHANNELS.AGENTS_OPEN_DOCS]: {
    channel: IPC_CHANNELS.AGENTS_OPEN_DOCS,
    input: AgentOpenDocsInputSchema,
    output: VoidOutputSchema,
  },
  [IPC_CHANNELS.MODELS_LIST]: {
    channel: IPC_CHANNELS.MODELS_LIST,
    input: ModelListInputSchema,
    output: ModelInfoListSchema,
  },
  [IPC_CHANNELS.MODELS_SET_TIER]: {
    channel: IPC_CHANNELS.MODELS_SET_TIER,
    input: ModelSetTierInputSchema,
    output: ModelInfoSchema,
  },
  [IPC_CHANNELS.PROJECTS_LIST]: {
    channel: IPC_CHANNELS.PROJECTS_LIST,
    input: EmptyInputSchema,
    output: ProjectRecordListSchema,
  },
  [IPC_CHANNELS.PROJECTS_GET]: {
    channel: IPC_CHANNELS.PROJECTS_GET,
    input: ProjectIdInputSchema,
    output: ProjectRecordSchema.nullable(),
  },
  [IPC_CHANNELS.PROJECTS_CREATE]: {
    channel: IPC_CHANNELS.PROJECTS_CREATE,
    input: ProjectCreateInputSchema,
    output: ProjectRecordSchema,
  },
  [IPC_CHANNELS.PROJECTS_OPEN]: {
    channel: IPC_CHANNELS.PROJECTS_OPEN,
    input: ProjectIdInputSchema,
    output: ProjectRecordSchema,
  },
  [IPC_CHANNELS.PROJECTS_VALIDATE_PATH]: {
    channel: IPC_CHANNELS.PROJECTS_VALIDATE_PATH,
    input: ProjectValidatePathInputSchema,
    output: ProjectPathValidationSchema,
  },
  [IPC_CHANNELS.PROJECTS_PICK_FOLDER]: {
    channel: IPC_CHANNELS.PROJECTS_PICK_FOLDER,
    input: EmptyInputSchema,
    output: ProjectPickFolderOutputSchema,
  },
  [IPC_CHANNELS.CONVERSATIONS_LIST]: {
    channel: IPC_CHANNELS.CONVERSATIONS_LIST,
    input: ConversationListInputSchema,
    output: ConversationRecordListSchema,
  },
  [IPC_CHANNELS.CONVERSATIONS_GET]: {
    channel: IPC_CHANNELS.CONVERSATIONS_GET,
    input: ConversationIdInputSchema,
    output: ConversationRecordSchema.nullable(),
  },
  [IPC_CHANNELS.CONVERSATIONS_CREATE]: {
    channel: IPC_CHANNELS.CONVERSATIONS_CREATE,
    input: ConversationCreateInputSchema,
    output: ConversationRecordSchema,
  },
  [IPC_CHANNELS.CONVERSATIONS_MESSAGES]: {
    channel: IPC_CHANNELS.CONVERSATIONS_MESSAGES,
    input: ConversationTargetInputSchema,
    output: MessageRecordListSchema,
  },
  [IPC_CHANNELS.CONVERSATIONS_STEPS]: {
    channel: IPC_CHANNELS.CONVERSATIONS_STEPS,
    input: ConversationTargetInputSchema,
    output: StepVMListSchema,
  },
  [IPC_CHANNELS.ORCHESTRATOR_SEND]: {
    channel: IPC_CHANNELS.ORCHESTRATOR_SEND,
    input: OrchestratorSendInputSchema,
    output: OrchestrationSendOutputSchema,
  },
  [IPC_CHANNELS.ORCHESTRATOR_CANCEL]: {
    channel: IPC_CHANNELS.ORCHESTRATOR_CANCEL,
    input: ConversationTargetInputSchema,
    output: VoidOutputSchema,
  },
  [IPC_CHANNELS.ORCHESTRATOR_SET_AI_PICK]: {
    channel: IPC_CHANNELS.ORCHESTRATOR_SET_AI_PICK,
    input: OrchestratorSetAiPickInputSchema,
    output: VoidOutputSchema,
  },
  [IPC_CHANNELS.PERMISSION_RESPOND]: {
    channel: IPC_CHANNELS.PERMISSION_RESPOND,
    input: PermissionRespondInputSchema,
    output: VoidOutputSchema,
  },
} as const;

export type IpcErrorCode = 'VALIDATION_ERROR' | 'INTERNAL_ERROR';

export const IpcErrorPayloadSchema = z.object({
  code: z.enum(['VALIDATION_ERROR', 'INTERNAL_ERROR']),
  message: z.string(),
});
export type IpcErrorPayload = z.infer<typeof IpcErrorPayloadSchema>;

export type IpcResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: IpcErrorPayload };

/**
 * Kiểu cầu nối Preload lộ ra tại window.codefleet (Luật B1, P3).
 */
export interface CodeFleetBridge {
  readonly appName: typeof APP_NAME;
  readonly appVersion: typeof APP_VERSION;
  readonly featureFlags: FeatureFlags;
  readonly settings: {
    get<K extends SettingKey>(key: K): Promise<IpcResult<AppSettingsMap[K]>>;
    getAll(): Promise<IpcResult<AppSettingsMap>>;
    set(input: SettingSetInput): Promise<IpcResult<AppSettingsMap>>;
  };
  readonly system: {
    checkGit(): Promise<IpcResult<GitCheckOutput>>;
    getDataInfo(): Promise<IpcResult<DataInfoOutput>>;
    openDataDir(): Promise<IpcResult<OpenDataDirOutput>>;
    backupNow(): Promise<IpcResult<BackupNowOutput>>;
  };
  readonly agents: {
    detectAll(): Promise<IpcResult<DetectResult[]>>;
    openLogin(agentId: AgentId): Promise<IpcResult<void>>;
    openDocs(agentId: AgentId): Promise<IpcResult<void>>;
  };
  readonly models: {
    list(agentId?: AgentId): Promise<IpcResult<ModelInfo[]>>;
    setTier(
      agentId: AgentId,
      modelId: string,
      tier: EditableModelTier,
    ): Promise<IpcResult<ModelInfo>>;
  };
  readonly projects: {
    list(): Promise<IpcResult<ProjectRecord[]>>;
    get(id: string): Promise<IpcResult<ProjectRecord | null>>;
    create(input: ProjectCreateInput): Promise<IpcResult<ProjectRecord>>;
    open(id: string): Promise<IpcResult<ProjectRecord>>;
    validatePath(path: string): Promise<IpcResult<ProjectPathValidation>>;
    pickFolder(): Promise<IpcResult<ProjectPickFolderOutput>>;
  };
  readonly conversations: {
    list(projectId: string): Promise<IpcResult<ConversationRecord[]>>;
    get(id: string): Promise<IpcResult<ConversationRecord | null>>;
    create(input: ConversationCreateInput): Promise<IpcResult<ConversationRecord>>;
    messages(conversationId: string): Promise<IpcResult<MessageRecord[]>>;
    steps(conversationId: string): Promise<IpcResult<StepVM[]>>;
  };
  readonly orchestrator: {
    send(input: OrchestratorSendInput): Promise<IpcResult<OrchestrationSendOutput>>;
    cancel(conversationId: string): Promise<IpcResult<void>>;
    setAiPick(conversationId: string, aiPick: AiPickOption): Promise<IpcResult<void>>;
    onEvent(callback: (event: OrchestrationEventPayload) => void): () => void;
  };
  readonly permission: {
    respond(input: PermissionRespondInput): Promise<IpcResult<void>>;
  };
}
