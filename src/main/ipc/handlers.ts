import { IPC_CHANNELS, IPC_CONTRACTS } from '@shared/ipc';
import type { DatabaseService } from '../db/database';
import { SettingsRepository } from '../db/settings-repo';
import type { Logger } from '../logger/logger';
import { registerTypedHandler, type IpcRegistrar } from './router';
import { checkSystemGit } from './system-git';

export interface IpcDependencies {
  readonly userDataDir: string;
  readonly dbService: DatabaseService;
  readonly logger: Logger;
  readonly openFolderInOs: (folderPath: string) => Promise<string>;
}

/**
 * Đăng ký toàn bộ kênh IPC của Phase 1.
 */
export function registerPhase1IpcHandlers(
  registrar: IpcRegistrar,
  deps: IpcDependencies,
): void {
  const settingsRepo = new SettingsRepository(deps.dbService.getConnection());
  const ipcLogger = deps.logger.child('ipc');

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SETTINGS_GET],
    ({ key }) => settingsRepo.get(key),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SETTINGS_GET_ALL],
    () => settingsRepo.getAll(),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SETTINGS_SET],
    (input) => {
      switch (input.key) {
        case 'ui.locale':
          settingsRepo.set('ui.locale', input.value);
          break;
        case 'ui.codeLevel':
          settingsRepo.set('ui.codeLevel', input.value);
          break;
        case 'ui.showJargon':
          settingsRepo.set('ui.showJargon', input.value);
          break;
        case 'ui.autoPreview':
          settingsRepo.set('ui.autoPreview', input.value);
          break;
      }
      ipcLogger.info('Updated user setting', { key: input.key });
      return settingsRepo.getAll();
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_CHECK_GIT],
    () => checkSystemGit(),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_GET_DATA_INFO],
    () => ({
      userDataDir: deps.userDataDir,
      dbPath: deps.dbService.getDbPath(),
      logFilePath: deps.logger.getLogFilePath(),
    }),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_OPEN_DATA_DIR],
    async () => {
      const errorMsg = await deps.openFolderInOs(deps.userDataDir);
      if (errorMsg) {
        return { opened: false, error: errorMsg };
      }
      return { opened: true, error: null };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.SYSTEM_BACKUP_NOW],
    () => deps.dbService.backupNow('user'),
    ipcLogger,
  );
}
