import { autoUpdater } from 'electron-updater';
import type { UpdaterBackend, UpdaterBackendEventMap } from './updater-service';

export class ElectronAutoUpdaterBackend implements UpdaterBackend {
  constructor() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  }

  get autoDownload(): boolean {
    return autoUpdater.autoDownload;
  }

  set autoDownload(val: boolean) {
    autoUpdater.autoDownload = val;
  }

  get allowPrerelease(): boolean {
    return autoUpdater.allowPrerelease;
  }

  set allowPrerelease(val: boolean) {
    autoUpdater.allowPrerelease = val;
  }

  get channel(): string | undefined {
    return autoUpdater.channel ?? undefined;
  }

  set channel(val: string | undefined) {
    if (val) {
      autoUpdater.channel = val;
    }
  }

  public async checkForUpdates() {
    return await autoUpdater.checkForUpdates();
  }

  public async downloadUpdate() {
    return await autoUpdater.downloadUpdate();
  }

  public quitAndInstall(isSilent = false, isForceRunAfter = true) {
    autoUpdater.quitAndInstall(isSilent, isForceRunAfter);
  }

  public on<K extends keyof UpdaterBackendEventMap>(
    event: K,
    handler: UpdaterBackendEventMap[K],
  ): void {
    autoUpdater.on(event, handler as (...args: unknown[]) => void);
  }
}
