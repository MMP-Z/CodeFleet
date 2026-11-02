import { contextBridge, ipcRenderer } from 'electron';
import type { z } from 'zod';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags, type FeatureFlags } from '@shared/feature-flags';
import {
  IPC_CHANNELS,
  IPC_CONTRACTS,
  IpcErrorPayloadSchema,
  type BackupNowOutput,
  type DataInfoOutput,
  type GitCheckOutput,
  type IpcContract,
  type IpcResult,
  type OpenDataDirOutput,
  type SettingSetInput,
} from '@shared/ipc';
import type { AppSettingsMap, SettingKey } from '@shared/settings';

async function invokeContract<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  contract: IpcContract<I, O>,
  input: z.infer<I>,
): Promise<IpcResult<z.infer<O>>> {
  const validatedInput = contract.input.parse(input);
  const rawResponse: unknown = await ipcRenderer.invoke(contract.channel, validatedInput);

  if (
    typeof rawResponse === 'object' &&
    rawResponse !== null &&
    'ok' in rawResponse &&
    typeof (rawResponse as { ok: unknown }).ok === 'boolean'
  ) {
    const envelope = rawResponse as { ok: boolean; data?: unknown; error?: unknown };
    if (envelope.ok) {
      const parsedData = contract.output.parse(envelope.data);
      return { ok: true, data: parsedData };
    }
    const parsedError = IpcErrorPayloadSchema.parse(envelope.error);
    return { ok: false, error: parsedError };
  }

  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Phản hồi IPC không đúng định dạng.',
    },
  };
}

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

const isDev = process.env['NODE_ENV'] !== 'production';

const bridge: CodeFleetBridge = {
  appName: APP_NAME,
  appVersion: APP_VERSION,
  featureFlags: resolveFeatureFlags(isDev),
  settings: {
    get: async <K extends SettingKey>(key: K): Promise<IpcResult<AppSettingsMap[K]>> => {
      const res = await invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SETTINGS_GET], { key });
      if (!res.ok) {
        return res;
      }
      return { ok: true, data: res.data as AppSettingsMap[K] };
    },
    getAll: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SETTINGS_GET_ALL], undefined),
    set: (input) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SETTINGS_SET], input),
  },
  system: {
    checkGit: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_CHECK_GIT], undefined),
    getDataInfo: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_GET_DATA_INFO], undefined),
    openDataDir: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_OPEN_DATA_DIR], undefined),
    backupNow: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_BACKUP_NOW], undefined),
  },
};

// Luật B1: Preload chỉ lộ ra API đã định nghĩa, không lộ Node/ipcRenderer thô.
contextBridge.exposeInMainWorld('codefleet', bridge);
