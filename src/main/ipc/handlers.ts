import { IPC_CHANNELS, IPC_CONTRACTS } from '@shared/ipc';
import { AgentRegistry } from '../agents/detect';
import { ModelTierService } from '../agents/models';
import { AgentSessionRepository } from '../agents/session-repo';
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
  readonly modelsService?: ModelTierService;
  readonly agentRegistry?: AgentRegistry;
}

/**
 * Đăng ký toàn bộ kênh IPC của Phase 1 và Phase 2.
 */
export function registerIpcHandlers(registrar: IpcRegistrar, deps: IpcDependencies): void {
  const settingsRepo = new SettingsRepository(deps.dbService.getConnection());
  const ipcLogger = deps.logger.child('ipc');

  const modelsService =
    deps.modelsService ??
    new ModelTierService({
      db: deps.dbService.getConnection(),
      userDataDir: deps.userDataDir,
    });

  const sessionRepo = new AgentSessionRepository(deps.dbService.getConnection());
  const agentRegistry =
    deps.agentRegistry ??
    new AgentRegistry({
      modelsService,
      sessionRepo,
    });

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
        case 'agents.enabled':
          settingsRepo.set('agents.enabled', input.value);
          break;
        case 'onboarding.completed':
          settingsRepo.set('onboarding.completed', input.value);
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

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.AGENTS_DETECT_ALL],
    () => agentRegistry.detectAll(),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.AGENTS_OPEN_LOGIN],
    async ({ agentId }) => {
      await agentRegistry.openLoginTerminal(agentId);
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.AGENTS_OPEN_DOCS],
    async ({ agentId }) => {
      await agentRegistry.openDocsUrl(agentId);
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.MODELS_LIST],
    ({ agentId }) => modelsService.listModels(agentId),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.MODELS_SET_TIER],
    ({ agentId, modelId, tier }) => modelsService.setModelTier(agentId, modelId, tier),
    ipcLogger,
  );
}

export const registerPhase1IpcHandlers = registerIpcHandlers;
