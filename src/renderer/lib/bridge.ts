import type { AgentId } from '@shared/agents';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import type { CodeFleetBridge } from '@shared/ipc';
import { DEFAULT_SETTINGS, type AppSettingsMap } from '@shared/settings';

const inMemoryFallbackState: AppSettingsMap = { ...DEFAULT_SETTINGS };

/**
 * Truy cập cầu nối Preload một cách an toàn.
 * Khi chạy trong môi trường test đơn vị jsdom chưa tiêm preload, trả về cầu nối bộ nhớ tạm có cùng kiểu.
 */
export const fallbackBridge: CodeFleetBridge = {
  appName: APP_NAME,
  appVersion: APP_VERSION,
  featureFlags: resolveFeatureFlags(true),
  settings: {
    get: async (key) => ({ ok: true, data: inMemoryFallbackState[key] }),
    getAll: async () => ({ ok: true, data: { ...inMemoryFallbackState } }),
    set: async (input) => {
      switch (input.key) {
        case 'ui.locale':
          inMemoryFallbackState['ui.locale'] = input.value;
          break;
        case 'ui.codeLevel':
          inMemoryFallbackState['ui.codeLevel'] = input.value;
          break;
        case 'ui.showJargon':
          inMemoryFallbackState['ui.showJargon'] = input.value;
          break;
        case 'ui.autoPreview':
          inMemoryFallbackState['ui.autoPreview'] = input.value;
          break;
        case 'agents.enabled':
          inMemoryFallbackState['agents.enabled'] = input.value;
          break;
        case 'onboarding.completed':
          inMemoryFallbackState['onboarding.completed'] = input.value;
          break;
      }
      return { ok: true, data: { ...inMemoryFallbackState } };
    },
  },
  system: {
    checkGit: async () => ({ ok: true, data: { available: true, version: '2.42.0' } }),
    getDataInfo: async () => ({
      ok: true,
      data: {
        userDataDir: 'C:/Users/ban/AppData/Roaming/CodeFleet',
        dbPath: 'C:/Users/ban/AppData/Roaming/CodeFleet/codefleet.sqlite',
        logFilePath: 'C:/Users/ban/AppData/Roaming/CodeFleet/logs/codefleet.log',
      },
    }),
    openDataDir: async () => ({ ok: true, data: { opened: true, error: null } }),
    backupNow: async () => ({
      ok: true,
      data: {
        backupPath: 'C:/Users/ban/AppData/Roaming/CodeFleet/backups/codefleet-user.sqlite.bak',
        createdAt: new Date().toISOString(),
        sizeBytes: 16384,
      },
    }),
  },
  agents: {
    detectAll: async () => ({
      ok: true,
      data: [
        {
          agentId: 'mock-agent' as AgentId,
          displayName: 'AI CLI Assistant',
          shortName: 'AI',
          logoLetter: 'A',
          color: '#2563EB',
          darkColor: '#3B82F6',
          docsUrl: 'https://example.com/docs',
          installCommand: 'echo "install"',
          loginCommand: 'echo "login"',
          installed: true,
          version: '1.0.0',
          loggedIn: true,
          status: 'ready',
          errorDetail: null,
          modelsCount: 1,
        },
      ],
    }),
    openLogin: async () => ({ ok: true, data: undefined }),
    openDocs: async () => ({ ok: true, data: undefined }),
  },
  models: {
    list: async () => ({ ok: true, data: [] }),
    setTier: async (agentId, modelId, tier) => ({
      ok: true,
      data: {
        id: modelId,
        agentId,
        agentDisplayName: 'AI CLI Assistant',
        label: modelId,
        tier,
        tierSource: 'user',
      },
    }),
  },
  projects: {
    list: async () => ({ ok: true, data: [] }),
    get: async () => ({ ok: true, data: null }),
    create: async (input) => ({
      ok: true,
      data: {
        id: 'proj-fallback',
        name: input.name,
        path: input.path,
        createdAt: new Date().toISOString(),
        lastOpened: new Date().toISOString(),
      },
    }),
    open: async (id) => ({
      ok: true,
      data: {
        id,
        name: 'Dự án mẫu',
        path: '/workspace/project',
        createdAt: new Date().toISOString(),
        lastOpened: new Date().toISOString(),
      },
    }),
    validatePath: async () => ({
      ok: true,
      data: {
        exists: true,
        isEmpty: true,
        isWritable: true,
        hasUserGit: false,
        errorDetail: null,
      },
    }),
    pickFolder: async () => ({
      ok: true,
      data: { canceled: false, folderPath: '/workspace/project' },
    }),
  },
  conversations: {
    list: async () => ({ ok: true, data: [] }),
    get: async () => ({ ok: true, data: null }),
    create: async (input) => ({
      ok: true,
      data: {
        id: 'conv-fallback',
        projectId: input.projectId,
        title: input.title ?? 'Hội thoại ban đầu',
        createdAt: new Date().toISOString(),
      },
    }),
    messages: async () => ({ ok: true, data: [] }),
    steps: async () => ({ ok: true, data: [] }),
  },
  orchestrator: {
    send: async () => ({ ok: true, data: { started: true } }),
    cancel: async () => ({ ok: true, data: undefined }),
    setAiPick: async () => ({ ok: true, data: undefined }),
    onEvent: () => () => {},
  },
  permission: {
    respond: async () => ({ ok: true, data: undefined }),
  },
  code: {
    stepDiff: async (stepId) => ({
      ok: true,
      data: {
        stepId,
        summary: 'Tóm tắt thay đổi code của bước này',
        fullDiff: '--- a/index.html\n+++ b/index.html\n+ <h1>Tiệm Bánh Nhỏ</h1>',
        files: [],
        whyApproach: 'Cách làm tối ưu và an toàn',
      },
    }),
    explainSegment: async () => ({
      ok: true,
      data: { explanation: 'Đoạn code này xử lý hiển thị giao diện theo yêu cầu.' },
    }),
  },
  checkpoints: {
    undoStep: async (stepId) => ({
      ok: true,
      data: { undoneStepId: stepId, affectedFiles: [], dependentStepsCount: 0 },
    }),
    redoStep: async (stepId) => ({
      ok: true,
      data: { redoneStepId: stepId },
    }),
  },
  directEdit: {
    getEditables: async () => ({ ok: true, data: [] }),
    saveDirect: async () => ({ ok: true, data: { ok: true, newContentHash: 'hash' } }),
  },
  conflict: {
    resolve: async () => ({ ok: true, data: { ok: true } }),
  },
  history: {
    get: async () => ({
      ok: true,
      data: { steps: [], userEdits: [], decisions: [] },
    }),
  },
  projectMap: {
    get: async () => ({ ok: true, data: [] }),
  },
  preview: {
    status: async () => ({
      ok: true,
      data: { isWebProject: true, isRunning: false, url: null, error: null },
    }),
    start: async () => ({
      ok: true,
      data: { ok: true, url: 'http://127.0.0.1:5173', error: null },
    }),
    stop: async () => ({ ok: true, data: undefined }),
  },
  quota: {
    getAll: async () => ({ ok: true, data: [] }),
    refresh: async () => ({ ok: true, data: [] }),
    onUpdate: () => () => {},
  },
};

export function getBridge(): CodeFleetBridge {
  if (typeof window !== 'undefined' && window.codefleet) {
    return window.codefleet;
  }
  return fallbackBridge;
}
