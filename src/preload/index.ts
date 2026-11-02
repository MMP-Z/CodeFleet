import { contextBridge, ipcRenderer } from 'electron';
import type { z } from 'zod';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import {
  IPC_CHANNELS,
  IPC_CONTRACTS,
  IpcErrorPayloadSchema,
  type CodeFleetBridge,
  type IpcContract,
  type IpcResult,
  type OrchestrationEventPayload,
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
  agents: {
    detectAll: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.AGENTS_DETECT_ALL], undefined),
    openLogin: (agentId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.AGENTS_OPEN_LOGIN], { agentId }),
    openDocs: (agentId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.AGENTS_OPEN_DOCS], { agentId }),
  },
  models: {
    list: (agentId) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.MODELS_LIST], { agentId }),
    setTier: (agentId, modelId, tier) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.MODELS_SET_TIER], { agentId, modelId, tier }),
  },
  projects: {
    list: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_LIST], undefined),
    get: (id) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_GET], { id }),
    create: (input) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_CREATE], input),
    open: (id) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_OPEN], { id }),
    validatePath: (projPath) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_VALIDATE_PATH], { path: projPath }),
    pickFolder: () => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_PICK_FOLDER], undefined),
  },
  conversations: {
    list: (projectId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_LIST], { projectId }),
    get: (id) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_GET], { id }),
    create: (input) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_CREATE], input),
    messages: (conversationId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_MESSAGES], { conversationId }),
    steps: (conversationId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_STEPS], { conversationId }),
  },
  orchestrator: {
    send: (input) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.ORCHESTRATOR_SEND], input),
    cancel: (conversationId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.ORCHESTRATOR_CANCEL], { conversationId }),
    setAiPick: (conversationId, aiPick) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.ORCHESTRATOR_SET_AI_PICK], {
        conversationId,
        aiPick,
      }),
    onEvent: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        callback(payload as OrchestrationEventPayload);
      };
      ipcRenderer.on('codefleet:orchestrator:event', handler);
      return () => {
        ipcRenderer.removeListener('codefleet:orchestrator:event', handler);
      };
    },
  },
  permission: {
    respond: (input) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PERMISSION_RESPOND], input),
  },
  code: {
    stepDiff: (stepId) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CODE_STEP_DIFF], { stepId }),
    explainSegment: (codeSnippet, language) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CODE_EXPLAIN_SEGMENT], { codeSnippet, language }),
  },
  checkpoints: {
    undoStep: (stepId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CHECKPOINT_UNDO_STEP], { stepId }),
    redoStep: (stepId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.CHECKPOINT_REDO_STEP], { stepId }),
  },
  directEdit: {
    getEditables: (projectId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECT_EDITABLES], { projectId }),
    saveDirect: (input) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.USER_EDITS_SAVE_DIRECT], input),
  },
  conflict: {
    resolve: (input) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECT_CONFLICT_RESOLVE], input),
  },
  history: {
    get: (projectId) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECT_HISTORY], { projectId }),
  },
  projectMap: {
    get: (projectId) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PROJECT_MAP], { projectId }),
  },
  preview: {
    status: (projectId) =>
      invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PREVIEW_STATUS], { projectId }),
    start: (projectId) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PREVIEW_START], { projectId }),
    stop: (projectId) => invokeContract(IPC_CONTRACTS[IPC_CHANNELS.PREVIEW_STOP], { projectId }),
  },
};

// Luật B1: Preload chỉ lộ ra API đã định nghĩa, không lộ Node/ipcRenderer thô.
contextBridge.exposeInMainWorld('codefleet', bridge);
