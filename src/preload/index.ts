import { contextBridge } from 'electron';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags, type FeatureFlags } from '@shared/feature-flags';

export interface CodeFleetBridge {
  readonly appName: typeof APP_NAME;
  readonly appVersion: typeof APP_VERSION;
  readonly featureFlags: FeatureFlags;
}

const isDev = process.env['NODE_ENV'] !== 'production';

const bridge: CodeFleetBridge = {
  appName: APP_NAME,
  appVersion: APP_VERSION,
  featureFlags: resolveFeatureFlags(isDev),
};

// Luật B1: Preload chỉ lộ ra API đã định nghĩa, không lộ Node/ipcRenderer thô.
contextBridge.exposeInMainWorld('codefleet', bridge);
