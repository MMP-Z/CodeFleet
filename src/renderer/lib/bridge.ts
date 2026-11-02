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
const fallbackBridge: CodeFleetBridge = {
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
};

export function getBridge(): CodeFleetBridge {
  if (typeof window !== 'undefined' && window.codefleet) {
    return window.codefleet;
  }
  return fallbackBridge;
}
