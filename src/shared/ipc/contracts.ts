import { z } from 'zod';
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
} as const;

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export const SettingGetInputSchema = z.object({
  key: SettingKeySchema,
});
export type SettingGetInput = z.infer<typeof SettingGetInputSchema>;

export const SettingValueSchema = z.union([LocaleSchema, CodeLevelSchema, z.boolean()]);
export type SettingValue = z.infer<typeof SettingValueSchema>;

export const SettingSetInputSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('ui.locale'), value: LocaleSchema }),
  z.object({ key: z.literal('ui.codeLevel'), value: CodeLevelSchema }),
  z.object({ key: z.literal('ui.showJargon'), value: z.boolean() }),
  z.object({ key: z.literal('ui.autoPreview'), value: z.boolean() }),
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
} as const;

export type IpcErrorCode = 'VALIDATION_ERROR' | 'INTERNAL_ERROR';

export const IpcErrorPayloadSchema = z.object({
  code: z.enum(['VALIDATION_ERROR', 'INTERNAL_ERROR']),
  message: z.string(),
});
export type IpcErrorPayload = z.infer<typeof IpcErrorPayloadSchema>;

export type IpcResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: IpcErrorPayload };

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
}

