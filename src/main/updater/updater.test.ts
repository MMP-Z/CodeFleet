import { describe, expect, it, vi } from 'vitest';
import type { UpdaterBackend, UpdaterBackendEventMap } from './updater-service';
import { AutoUpdaterService } from './updater-service';
import type { SettingsRepository } from '../db/settings-repo';

class MockUpdaterBackend implements UpdaterBackend {
  public autoDownload = true;
  public allowPrerelease = false;
  public channel?: string;

  private handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  public on<K extends keyof UpdaterBackendEventMap>(
    event: K,
    handler: UpdaterBackendEventMap[K],
  ): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as (...args: unknown[]) => void);
    this.handlers.set(event, list);
  }

  public emit<K extends keyof UpdaterBackendEventMap>(
    event: K,
    ...args: Parameters<UpdaterBackendEventMap[K]>
  ): void {
    const list = this.handlers.get(event) ?? [];
    for (const fn of list) {
      fn(...args);
    }
  }

  public nextCheckResult: {
    updateInfo?: { version: string; releaseDate?: string; releaseNotes?: string | null };
  } | null = null;

  public async checkForUpdates() {
    this.emit('checking-for-update');
    return this.nextCheckResult;
  }

  public downloadCalled = false;
  public async downloadUpdate() {
    this.downloadCalled = true;
    return 'downloaded';
  }

  public quitCalled = false;
  public quitAndInstall() {
    this.quitCalled = true;
  }
}

describe('AutoUpdaterService (Phase 7)', () => {
  const createMockSettingsRepo = () => {
    const store = new Map<string, unknown>();
    return {
      get: vi.fn((key: string) => store.get(key)),
      set: vi.fn((key: string, val: unknown) => store.set(key, val)),
      getAll: vi.fn(() => Object.fromEntries(store.entries())),
    } as unknown as SettingsRepository;
  };

  it('initializes with default state and synchronizes with SettingsRepo', () => {
    const repo = createMockSettingsRepo();
    const backend = new MockUpdaterBackend();
    const service = new AutoUpdaterService({
      currentVersion: '0.1.0',
      settingsRepo: repo,
      backend,
    });

    const state = service.getState();
    expect(state.currentVersion).toBe('0.1.0');
    expect(state.channel).toBe('stable');
    expect(state.autoDownload).toBe(true);
    expect(state.status).toBe('idle');
    expect(state.availableVersion).toBeNull();
  });

  it('toggles channel and autoDownload and persists to settings', async () => {
    const repo = createMockSettingsRepo();
    const backend = new MockUpdaterBackend();
    const service = new AutoUpdaterService({
      currentVersion: '0.1.0',
      settingsRepo: repo,
      backend,
    });

    await service.setChannel('beta');
    expect(service.getState().channel).toBe('beta');
    expect(backend.allowPrerelease).toBe(true);
    expect(repo.set).toHaveBeenCalledWith('update.channel', 'beta');

    await service.setAutoDownload(false);
    expect(service.getState().autoDownload).toBe(false);
    expect(backend.autoDownload).toBe(false);
    expect(repo.set).toHaveBeenCalledWith('update.autoDownload', false);
  });

  it('handles update check when no new version exists', async () => {
    const backend = new MockUpdaterBackend();
    const service = new AutoUpdaterService({
      currentVersion: '0.1.0',
      backend,
    });

    backend.nextCheckResult = {
      updateInfo: { version: '0.1.0' },
    };

    const res = await service.checkForUpdates();
    expect(res.hasUpdate).toBe(false);
    expect(service.getState().status).toBe('not-available');
    expect(service.getState().availableVersion).toBeNull();
  });

  it('handles update check when a newer version is available and autoDownload is false', async () => {
    const backend = new MockUpdaterBackend();
    const service = new AutoUpdaterService({
      currentVersion: '0.1.0',
      backend,
    });
    await service.setAutoDownload(false);

    backend.nextCheckResult = {
      updateInfo: {
        version: '0.2.0',
        releaseDate: '2026-11-03T00:00:00Z',
        releaseNotes: 'Bổ sung tính năng mới',
      },
    };

    const res = await service.checkForUpdates();
    expect(res.hasUpdate).toBe(true);
    expect(res.version).toBe('0.2.0');
    expect(service.getState().status).toBe('available');
    expect(service.getState().availableVersion).toBe('0.2.0');
    expect(service.getState().releaseNotes).toBe('Bổ sung tính năng mới');
  });

  it('transitions through download-progress and update-downloaded', async () => {
    const backend = new MockUpdaterBackend();
    const service = new AutoUpdaterService({
      currentVersion: '0.1.0',
      backend,
    });

    const states: string[] = [];
    service.onStateChange((s) => states.push(s.status));

    backend.emit('download-progress', {
      percent: 45.67,
      bytesPerSecond: 1024000,
      transferred: 4500000,
      total: 10000000,
    });

    expect(service.getState().status).toBe('downloading');
    expect(service.getState().downloadProgress?.percent).toBe(45.7);

    backend.emit('update-downloaded', {
      version: '0.2.0',
      releaseNotes: 'Bản vá lỗi',
    });

    expect(service.getState().status).toBe('downloaded');
    expect(service.getState().availableVersion).toBe('0.2.0');

    service.quitAndInstall();
    expect(backend.quitCalled).toBe(true);
  });

  it('handles error gracefully without crashing', () => {
    const backend = new MockUpdaterBackend();
    const service = new AutoUpdaterService({
      currentVersion: '0.1.0',
      backend,
    });

    backend.emit('error', new Error('Network connection timed out'));
    expect(service.getState().status).toBe('error');
    expect(service.getState().error).toContain('Network connection timed out');
  });
});
