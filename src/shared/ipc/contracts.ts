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
import type { OrchestrationLogEntry, StepCodeVM, StepUiStatus } from '../vm';
import {
  PluginManifestSchema,
  PluginPermissionSchema,
  type PluginManifest,
  type PluginVM,
} from '../plugins/manifest';

export * from '../plugins/manifest';
export type { OrchestrationLogEntry, StepCodeVM, StepUiStatus };

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
  CODE_STEP_DIFF: 'code.stepDiff',
  CODE_EXPLAIN_SEGMENT: 'code.explainSegment',
  CHECKPOINT_UNDO_STEP: 'checkpoint.undoStep',
  CHECKPOINT_REDO_STEP: 'checkpoint.redoStep',
  PROJECT_EDITABLES: 'project.editables',
  USER_EDITS_SAVE_DIRECT: 'userEdits.saveDirect',
  PROJECT_CONFLICT_RESOLVE: 'project.conflictResolve',
  PROJECT_HISTORY: 'project.history',
  PROJECT_MAP: 'project.map',
  PREVIEW_STATUS: 'preview.status',
  PREVIEW_START: 'preview.start',
  PREVIEW_STOP: 'preview.stop',
  QUOTA_GET_ALL: 'quota.getAll',
  QUOTA_REFRESH: 'quota.refresh',
  PLUGINS_LIST: 'plugins.list',
  PLUGINS_INSTALL: 'plugins.install',
  PLUGINS_UNINSTALL: 'plugins.uninstall',
  PLUGINS_TOGGLE: 'plugins.toggle',
  PLUGINS_INSPECT_FROM_URL: 'plugins.inspectFromUrl',
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
    'conflict_detected',
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

export const StepTargetInputSchema = z.object({
  stepId: z.string().min(1),
});
export type StepTargetInput = z.infer<typeof StepTargetInputSchema>;

export const StepFileVMSchema = z.object({
  id: z.string(),
  path: z.string(),
  change: z.enum(['added', 'modified', 'deleted']),
  riskTags: z.array(z.string()).nullable(),
  diffSummary: z.string().nullable(),
  fullDiff: z.string().nullable(),
});
export type StepFileVM = z.infer<typeof StepFileVMSchema>;

export const StepDiffOutputSchema = z.object({
  stepId: z.string(),
  summary: z.string().nullable(),
  fullDiff: z.string().nullable(),
  files: z.array(StepFileVMSchema),
  whyApproach: z.string().nullable(),
});
export type StepDiffOutput = z.infer<typeof StepDiffOutputSchema>;

export const ExplainSegmentInputSchema = z.object({
  codeSnippet: z.string(),
  language: z.string().optional(),
});
export type ExplainSegmentInput = z.infer<typeof ExplainSegmentInputSchema>;

export const ExplainSegmentOutputSchema = z.object({
  explanation: z.string(),
});
export type ExplainSegmentOutput = z.infer<typeof ExplainSegmentOutputSchema>;

export const UndoStepOutputSchema = z.object({
  undoneStepId: z.string(),
  affectedFiles: z.array(z.string()),
  dependentStepsCount: z.number(),
});
export type UndoStepOutput = z.infer<typeof UndoStepOutputSchema>;

export const RedoStepOutputSchema = z.object({
  redoneStepId: z.string(),
});
export type RedoStepOutput = z.infer<typeof RedoStepOutputSchema>;

export const ProjectTargetInputSchema = z.object({
  projectId: z.string().min(1),
});
export type ProjectTargetInput = z.infer<typeof ProjectTargetInputSchema>;

export const EditableLocatorSchema = z.object({
  line: z.number(),
  col: z.number(),
  length: z.number(),
  originalSnippet: z.string(),
});
export type EditableLocatorVM = z.infer<typeof EditableLocatorSchema>;

export const EditableItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['text', 'color', 'number']),
  label: z.string(),
  value: z.string(),
  file: z.string(),
  locator: EditableLocatorSchema,
});
export type EditableItemVM = z.infer<typeof EditableItemSchema>;
export const EditableItemListSchema = z.array(EditableItemSchema);

export const SaveDirectEditInputSchema = z.object({
  projectId: z.string(),
  filePath: z.string(),
  locator: EditableLocatorSchema,
  newValue: z.string(),
});
export type SaveDirectEditInput = z.infer<typeof SaveDirectEditInputSchema>;

export const SaveDirectEditOutputSchema = z.object({
  ok: z.boolean(),
  newContentHash: z.string(),
});
export type SaveDirectEditOutput = z.infer<typeof SaveDirectEditOutputSchema>;

export const ConflictResolutionChoiceSchema = z.enum(['keep_user_ask_ai', 'keep_user', 'use_ai']);
export type ConflictResolutionChoice = z.infer<typeof ConflictResolutionChoiceSchema>;

export const FileConflictSchema = z.object({
  projectId: z.string(),
  stepId: z.string(),
  filePath: z.string(),
  userVersion: z.string(),
  aiVersion: z.string(),
  userEditedAt: z.string().optional(),
  plainExplain: z.string().optional(),
  userLines: z.number().int().optional(),
  aiLines: z.number().int().optional(),
});
export type FileConflictVM = z.infer<typeof FileConflictSchema>;

export const ConflictResolveInputSchema = z.object({
  projectId: z.string(),
  stepId: z.string(),
  filePath: z.string(),
  choice: ConflictResolutionChoiceSchema,
  userVersion: z.string(),
  aiVersion: z.string(),
});
export type ConflictResolveInput = z.infer<typeof ConflictResolveInputSchema>;

export const ConflictResolveOutputSchema = z.object({
  ok: z.boolean(),
});
export type ConflictResolveOutput = z.infer<typeof ConflictResolveOutputSchema>;

export const UserEditItemSchema = z.object({
  id: z.string(),
  path: z.string(),
  editedAt: z.string(),
});
export type UserEditItemVM = z.infer<typeof UserEditItemSchema>;

export const DecisionItemSchema = z.object({
  id: z.string(),
  stepId: z.string().nullable(),
  kind: z.enum(['approach', 'pick', 'switch']),
  text: z.string(),
  createdAt: z.string(),
});
export type DecisionItemVM = z.infer<typeof DecisionItemSchema>;

export const ProjectHistoryOutputSchema = z.object({
  steps: z.array(StepVMSchema),
  userEdits: z.array(UserEditItemSchema),
  decisions: z.array(DecisionItemSchema),
});
export type ProjectHistoryOutput = z.infer<typeof ProjectHistoryOutputSchema>;

export const ProjectMapItemSchema = z.object({
  id: z.string(),
  feature: z.string(),
  description: z.string().nullable(),
  files: z.array(z.string()),
  isSensitive: z.boolean().optional(),
  updatedAt: z.string(),
});
export type ProjectMapItemVM = z.infer<typeof ProjectMapItemSchema>;
export const ProjectMapItemListSchema = z.array(ProjectMapItemSchema);

export const PreviewStatusOutputSchema = z.object({
  isWebProject: z.boolean(),
  isRunning: z.boolean(),
  url: z.string().nullable(),
  error: z.string().nullable(),
});
export type PreviewStatusOutput = z.infer<typeof PreviewStatusOutputSchema>;

export const PreviewStartOutputSchema = z.object({
  ok: z.boolean(),
  url: z.string().nullable(),
  error: z.string().nullable(),
});
export type PreviewStartOutput = z.infer<typeof PreviewStartOutputSchema>;

// === PHASE 5: HẠN MỨC (QUOTA) ===

export const QuotaSourceSchema = z.enum(['official', 'estimated', 'detected', 'unknown']);
export type QuotaSource = z.infer<typeof QuotaSourceSchema>;

export const QuotaScopeSchema = z.enum(['model', 'shared', 'unknown']);
export type QuotaScope = z.infer<typeof QuotaScopeSchema>;

export const QuotaStatusSchema = z.enum(['ok', 'low', 'exhausted', 'unknown']);
export type QuotaStatus = z.infer<typeof QuotaStatusSchema>;

export const QuotaWindowSchema = z.object({
  label: z.string(),
  usedPercent: z.number().nullable(),
  resetsAt: z.string().nullable(),
});
export type QuotaWindow = z.infer<typeof QuotaWindowSchema>;

export const QuotaSnapshotSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  model: z.string().nullable(),
  scope: QuotaScopeSchema,
  plan: z.string().nullable(),
  windows: z.array(QuotaWindowSchema),
  status: QuotaStatusSchema,
  source: QuotaSourceSchema,
  capturedAt: z.string(),
});
export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;
export const QuotaSnapshotListSchema = z.array(QuotaSnapshotSchema);

export const InstallPluginInputSchema = z.object({
  pluginId: z.string().min(1),
  grantedPermissions: z.array(PluginPermissionSchema),
  externalManifest: PluginManifestSchema.optional(),
});
export type InstallPluginInput = z.infer<typeof InstallPluginInputSchema>;

export const UninstallPluginInputSchema = z.object({
  pluginId: z.string().min(1),
});
export type UninstallPluginInput = z.infer<typeof UninstallPluginInputSchema>;

export const TogglePluginInputSchema = z.object({
  pluginId: z.string().min(1),
  enabled: z.boolean(),
});
export type TogglePluginInput = z.infer<typeof TogglePluginInputSchema>;

export const InspectPluginUrlInputSchema = z.object({
  url: z.string().min(1),
});
export type InspectPluginUrlInput = z.infer<typeof InspectPluginUrlInputSchema>;

export const PluginVMListSchema = z.array(z.custom<PluginVM>());
export const PluginVMSchema = z.custom<PluginVM>();

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
  [IPC_CHANNELS.CODE_STEP_DIFF]: {
    channel: IPC_CHANNELS.CODE_STEP_DIFF,
    input: StepTargetInputSchema,
    output: StepDiffOutputSchema,
  },
  [IPC_CHANNELS.CODE_EXPLAIN_SEGMENT]: {
    channel: IPC_CHANNELS.CODE_EXPLAIN_SEGMENT,
    input: ExplainSegmentInputSchema,
    output: ExplainSegmentOutputSchema,
  },
  [IPC_CHANNELS.CHECKPOINT_UNDO_STEP]: {
    channel: IPC_CHANNELS.CHECKPOINT_UNDO_STEP,
    input: StepTargetInputSchema,
    output: UndoStepOutputSchema,
  },
  [IPC_CHANNELS.CHECKPOINT_REDO_STEP]: {
    channel: IPC_CHANNELS.CHECKPOINT_REDO_STEP,
    input: StepTargetInputSchema,
    output: RedoStepOutputSchema,
  },
  [IPC_CHANNELS.PROJECT_EDITABLES]: {
    channel: IPC_CHANNELS.PROJECT_EDITABLES,
    input: ProjectTargetInputSchema,
    output: EditableItemListSchema,
  },
  [IPC_CHANNELS.USER_EDITS_SAVE_DIRECT]: {
    channel: IPC_CHANNELS.USER_EDITS_SAVE_DIRECT,
    input: SaveDirectEditInputSchema,
    output: SaveDirectEditOutputSchema,
  },
  [IPC_CHANNELS.PROJECT_CONFLICT_RESOLVE]: {
    channel: IPC_CHANNELS.PROJECT_CONFLICT_RESOLVE,
    input: ConflictResolveInputSchema,
    output: ConflictResolveOutputSchema,
  },
  [IPC_CHANNELS.PROJECT_HISTORY]: {
    channel: IPC_CHANNELS.PROJECT_HISTORY,
    input: ProjectTargetInputSchema,
    output: ProjectHistoryOutputSchema,
  },
  [IPC_CHANNELS.PROJECT_MAP]: {
    channel: IPC_CHANNELS.PROJECT_MAP,
    input: ProjectTargetInputSchema,
    output: ProjectMapItemListSchema,
  },
  [IPC_CHANNELS.PREVIEW_STATUS]: {
    channel: IPC_CHANNELS.PREVIEW_STATUS,
    input: ProjectTargetInputSchema,
    output: PreviewStatusOutputSchema,
  },
  [IPC_CHANNELS.PREVIEW_START]: {
    channel: IPC_CHANNELS.PREVIEW_START,
    input: ProjectTargetInputSchema,
    output: PreviewStartOutputSchema,
  },
  [IPC_CHANNELS.PREVIEW_STOP]: {
    channel: IPC_CHANNELS.PREVIEW_STOP,
    input: ProjectTargetInputSchema,
    output: VoidOutputSchema,
  },
  [IPC_CHANNELS.QUOTA_GET_ALL]: {
    channel: IPC_CHANNELS.QUOTA_GET_ALL,
    input: EmptyInputSchema,
    output: QuotaSnapshotListSchema,
  },
  [IPC_CHANNELS.QUOTA_REFRESH]: {
    channel: IPC_CHANNELS.QUOTA_REFRESH,
    input: EmptyInputSchema,
    output: QuotaSnapshotListSchema,
  },
  [IPC_CHANNELS.PLUGINS_LIST]: {
    channel: IPC_CHANNELS.PLUGINS_LIST,
    input: EmptyInputSchema,
    output: PluginVMListSchema,
  },
  [IPC_CHANNELS.PLUGINS_INSTALL]: {
    channel: IPC_CHANNELS.PLUGINS_INSTALL,
    input: InstallPluginInputSchema,
    output: PluginVMSchema,
  },
  [IPC_CHANNELS.PLUGINS_UNINSTALL]: {
    channel: IPC_CHANNELS.PLUGINS_UNINSTALL,
    input: UninstallPluginInputSchema,
    output: z.boolean(),
  },
  [IPC_CHANNELS.PLUGINS_TOGGLE]: {
    channel: IPC_CHANNELS.PLUGINS_TOGGLE,
    input: TogglePluginInputSchema,
    output: z.boolean(),
  },
  [IPC_CHANNELS.PLUGINS_INSPECT_FROM_URL]: {
    channel: IPC_CHANNELS.PLUGINS_INSPECT_FROM_URL,
    input: InspectPluginUrlInputSchema,
    output: PluginManifestSchema,
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
  readonly code: {
    stepDiff(stepId: string): Promise<IpcResult<StepDiffOutput>>;
    explainSegment(
      codeSnippet: string,
      language?: string,
    ): Promise<IpcResult<ExplainSegmentOutput>>;
  };
  readonly checkpoints: {
    undoStep(stepId: string): Promise<IpcResult<UndoStepOutput>>;
    redoStep(stepId: string): Promise<IpcResult<RedoStepOutput>>;
  };
  readonly directEdit: {
    getEditables(projectId: string): Promise<IpcResult<EditableItemVM[]>>;
    saveDirect(input: SaveDirectEditInput): Promise<IpcResult<SaveDirectEditOutput>>;
  };
  readonly conflict: {
    resolve(input: ConflictResolveInput): Promise<IpcResult<ConflictResolveOutput>>;
  };
  readonly history: {
    get(projectId: string): Promise<IpcResult<ProjectHistoryOutput>>;
  };
  readonly projectMap: {
    get(projectId: string): Promise<IpcResult<ProjectMapItemVM[]>>;
  };
  readonly preview: {
    status(projectId: string): Promise<IpcResult<PreviewStatusOutput>>;
    start(projectId: string): Promise<IpcResult<PreviewStartOutput>>;
    stop(projectId: string): Promise<IpcResult<void>>;
  };
  readonly quota: {
    getAll(): Promise<IpcResult<QuotaSnapshot[]>>;
    refresh(): Promise<IpcResult<QuotaSnapshot[]>>;
    onUpdate(callback: (snapshots: QuotaSnapshot[]) => void): () => void;
  };
  readonly plugins: {
    list(): Promise<IpcResult<PluginVM[]>>;
    install(input: InstallPluginInput): Promise<IpcResult<PluginVM>>;
    uninstall(input: UninstallPluginInput): Promise<IpcResult<boolean>>;
    toggle(input: TogglePluginInput): Promise<IpcResult<boolean>>;
    inspectFromUrl(input: InspectPluginUrlInput): Promise<IpcResult<PluginManifest>>;
  };
}
