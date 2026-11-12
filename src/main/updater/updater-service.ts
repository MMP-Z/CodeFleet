import { app } from 'electron';
import type { SettingsRepository } from '../db/settings-repo';
import type {
  UpdateChannel,
  UpdateCheckResult,
  UpdateProgress,
  UpdateState,
} from '../../shared/updater';

export interface UpdaterBackendEventMap {
  'checking-for-update': () => void;
  'update-available': (info: {
    version: string;
    releaseDate?: string;
    releaseNotes?: string | Array<unknown> | null;
  }) => void;
  'update-not-available': (info: { version: string }) => void;
  'download-progress': (progress: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  }) => void;
  'update-downloaded': (info: {
    version: string;
    releaseNotes?: string | Array<unknown> | null;
  }) => void;
  error: (err: Error) => void;
}

export interface UpdaterBackend {
  autoDownload: boolean;
  allowPrerelease: boolean;
  channel?: string;
  checkForUpdates(): Promise<{
    updateInfo?: {
      version: string;
      releaseDate?: string;
      releaseNotes?: string | Array<unknown> | null;
    };
  } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on<K extends keyof UpdaterBackendEventMap>(event: K, handler: UpdaterBackendEventMap[K]): void;
}

export interface AutoUpdaterServiceOptions {
  readonly currentVersion?: string;
  readonly settingsRepo?: SettingsRepository;
  readonly backend?: UpdaterBackend;
  readonly isDev?: boolean;
}

export class AutoUpdaterService {
  private state: UpdateState;
  private readonly listeners = new Set<(state: UpdateState) => void>();
  private readonly backend?: UpdaterBackend;
  private readonly settingsRepo?: SettingsRepository;
  private readonly isDev: boolean;

  constructor(options: AutoUpdaterServiceOptions = {}) {
    const defaultVersion =
      options.currentVersion ??
      (typeof app?.getVersion === 'function' ? app.getVersion() : '0.1.0');

    this.settingsRepo = options.settingsRepo;
    this.backend = options.backend;
    this.isDev = options.isDev ?? false;

    const initialChannel: UpdateChannel = this.settingsRepo?.get('update.channel') ?? 'stable';
    const initialAutoDownload = this.settingsRepo?.get('update.autoDownload') ?? true;

    this.state = {
      status: 'idle',
      currentVersion: defaultVersion,
      channel: initialChannel,
      autoDownload: initialAutoDownload,
      availableVersion: null,
      releaseDate: null,
      releaseNotes: null,
      downloadProgress: null,
      lastCheckedAt: null,
      error: null,
    };

    if (this.backend) {
      this.backend.autoDownload = initialAutoDownload;
      this.backend.allowPrerelease = initialChannel === 'beta';
      this.attachBackendEvents(this.backend);
    }
  }

  public get isDevMode(): boolean {
    return this.isDev;
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  public onStateChange(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in AutoUpdaterService listener:', err);
      }
    }
  }

  private updateState(partial: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.notify();
  }

  private attachBackendEvents(backend: UpdaterBackend): void {
    backend.on('checking-for-update', () => {
      this.updateState({
        status: 'checking',
        error: null,
      });
    });

    backend.on('update-available', (info) => {
      this.updateState({
        status: this.state.autoDownload ? 'downloading' : 'available',
        availableVersion: info.version,
        releaseDate: info.releaseDate ?? new Date().toISOString(),
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        error: null,
      });
    });

    backend.on('update-not-available', () => {
      this.updateState({
        status: 'not-available',
        availableVersion: null,
        lastCheckedAt: new Date().toISOString(),
        error: null,
      });
    });

    backend.on('download-progress', (progress) => {
      const p: UpdateProgress = {
        percent: Math.round(progress.percent * 10) / 10,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      };
      this.updateState({
        status: 'downloading',
        downloadProgress: p,
      });
    });

    backend.on('update-downloaded', (info) => {
      this.updateState({
        status: 'downloaded',
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        downloadProgress: null,
        error: null,
      });
    });

    backend.on('error', (err) => {
      this.updateState({
        status: 'error',
        error: err.message,
      });
    });
  }

  public async setChannel(channel: UpdateChannel): Promise<void> {
    this.settingsRepo?.set('update.channel', channel);
    if (this.backend) {
      this.backend.allowPrerelease = channel === 'beta';
    }
    this.updateState({ channel });
  }

  public async setAutoDownload(autoDownload: boolean): Promise<void> {
    this.settingsRepo?.set('update.autoDownload', autoDownload);
    if (this.backend) {
      this.backend.autoDownload = autoDownload;
    }
    this.updateState({ autoDownload });
  }

  public async checkForUpdates(manual = true): Promise<UpdateCheckResult> {
    const now = new Date().toISOString();
    this.updateState({
      status: 'checking',
      lastCheckedAt: now,
      error: null,
    });

    if (!this.backend) {
      // Khi không có backend (e.g. dev hoặc test không gắn mock), chuyển trạng thái not-available an toàn
      this.updateState({
        status: 'not-available',
        availableVersion: null,
      });
      return {
        hasUpdate: false,
        version: null,
        releaseNotes: null,
      };
    }

    try {
      const result = await this.backend.checkForUpdates();
      if (!result?.updateInfo) {
        this.updateState({
          status: 'not-available',
          availableVersion: null,
        });
        return {
          hasUpdate: false,
          version: null,
          releaseNotes: null,
        };
      }

      const info = result.updateInfo;
      const isNewer = this.compareVersions(info.version, this.state.currentVersion) > 0;

      if (isNewer) {
        this.updateState({
          status: this.state.autoDownload ? 'downloading' : 'available',
          availableVersion: info.version,
          releaseDate: info.releaseDate ?? now,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        });
        return {
          hasUpdate: true,
          version: info.version,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        };
      } else {
        this.updateState({
          status: 'not-available',
          availableVersion: null,
        });
        return {
          hasUpdate: false,
          version: null,
          releaseNotes: null,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: 'error',
        error: msg,
      });
      if (manual) {
        // Trả về không có update nhưng ghi nhận error
        return {
          hasUpdate: false,
          version: null,
          releaseNotes: null,
        };
      }
      throw err;
    }
  }

  public async downloadUpdate(): Promise<void> {
    if (!this.backend) return;
    this.updateState({
      status: 'downloading',
      error: null,
    });
    try {
      await this.backend.downloadUpdate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: 'error',
        error: msg,
      });
      throw err;
    }
  }

  public quitAndInstall(): void {
    if (!this.backend) return;
    this.backend.quitAndInstall(false, true);
  }

  /**
   * So sánh semver x.y.z đơn giản
   */
  private compareVersions(v1: string, v2: string): number {
    const clean = (v: string) => v.replace(/^v/, '').split('-')[0] ?? '';
    const parts1 = clean(v1)
      .split('.')
      .map((p) => parseInt(p, 10) || 0);
    const parts2 = clean(v2)
      .split('.')
      .map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}
