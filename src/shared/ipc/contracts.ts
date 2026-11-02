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
}
