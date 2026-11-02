import { IPC_CHANNELS, IPC_CONTRACTS, type AgentId, type StepVM } from '@shared/ipc';
import { AgentRegistry } from '../agents/detect';
import { ModelTierService } from '../agents/models';
import { AgentSessionRepository } from '../agents/session-repo';
import { ConversationRepository, type StepRecord } from '../db/conversation-repo';
import type { DatabaseService } from '../db/database';
import { DecisionRepository } from '../db/decision-repo';
import { ProjectRepository } from '../db/project-repo';
import { SettingsRepository } from '../db/settings-repo';
import type { Logger } from '../logger/logger';
import { Orchestrator } from '../orchestrator/orchestrator';
import { validateProjectPath } from './project-path';
import { registerTypedHandler, type IpcRegistrar } from './router';
import { checkSystemGit } from './system-git';

export interface IpcDependencies {
  readonly userDataDir: string;
  readonly dbService: DatabaseService;
  readonly logger: Logger;
  readonly openFolderInOs: (folderPath: string) => Promise<string>;
  readonly modelsService?: ModelTierService;
  readonly agentRegistry?: AgentRegistry;
  readonly projectRepo?: ProjectRepository;
  readonly convRepo?: ConversationRepository;
  readonly decisionRepo?: DecisionRepository;
  readonly orchestrator?: Orchestrator;
  readonly pickFolderDialog?: () => Promise<{ canceled: boolean; folderPath: string | null }>;
  readonly broadcastEvent?: (channel: string, payload: unknown) => void;
}

function mapStepToVm(
  step: StepRecord,
  agentRegistry: AgentRegistry,
  modelsService: ModelTierService,
  decisionRepo: DecisionRepository,
  convRepo: ConversationRepository,
): StepVM {
  const agent = agentRegistry.get(step.agentId as AgentId);
  const agentLabel = agent?.displayName ?? step.agentId;
  const agentColor = agent?.color ?? '#55625D';
  let modelLabel: string | null = null;
  if (step.model) {
    const info = modelsService.resolveModelInfo(step.agentId as AgentId, { id: step.model });
    modelLabel = info.label;
  }
  const latestSwitch = decisionRepo.getLatestForStep(step.id, 'switch');
  const files = convRepo.listStepFiles(step.id);

  return {
    id: step.id,
    seq: step.seq,
    title: step.summary ?? `Bước ${step.seq}`,
    agentId: step.agentId as AgentId,
    agentLabel,
    agentColor,
    modelLabel,
    status: step.status,
    note: latestSwitch ? latestSwitch.text : null,
    riskLevel: step.riskLevel,
    riskText: step.riskLevel === 'high' ? 'Liên quan mã nguồn nhạy cảm' : null,
    hasCode: files.length > 0,
  };
}

/**
 * Đăng ký toàn bộ kênh IPC của Phase 1, Phase 2 và Phase 3.
 */
export function registerIpcHandlers(registrar: IpcRegistrar, deps: IpcDependencies): void {
  const db = deps.dbService.getConnection();
  const settingsRepo = new SettingsRepository(db);
  const projectRepo = deps.projectRepo ?? new ProjectRepository(db);
  const convRepo = deps.convRepo ?? new ConversationRepository(db);
  const decisionRepo = deps.decisionRepo ?? new DecisionRepository(db);
  const ipcLogger = deps.logger.child('ipc');

  const modelsService =
    deps.modelsService ??
    new ModelTierService({
      db,
      userDataDir: deps.userDataDir,
    });

  const sessionRepo = new AgentSessionRepository(db);
  const agentRegistry =
    deps.agentRegistry ??
    new AgentRegistry({
      modelsService,
      sessionRepo,
    });

  const orchestrator =
    deps.orchestrator ??
    new Orchestrator({
      registry: agentRegistry,
      modelService: modelsService,
      convRepo,
      projRepo: projectRepo,
      decisionRepo,
      settingsRepo,
      logger: deps.logger.child('orchestrator'),
    });

  // Lắng nghe sự kiện từ Orchestrator và broadcast xuống renderer
  orchestrator.on('event', (payload) => {
    if (deps.broadcastEvent) {
      deps.broadcastEvent('codefleet:orchestrator:event', payload);
    }
  });

  // === SETTINGS (PHASE 1) ===
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
      settingsRepo.set(input.key, input.value);
      return settingsRepo.getAll();
    },
    ipcLogger,
  );

  // === SYSTEM (PHASE 1) ===
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

  // === AGENTS & MODELS (PHASE 2) ===
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

  // === PROJECTS (PHASE 3) ===
  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_LIST],
    () => projectRepo.list(),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_GET],
    ({ id }) => projectRepo.getById(id),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_CREATE],
    ({ name, path: projPath }) => {
      const created = projectRepo.create({ name, path: projPath });
      // Tạo sẵn 1 conversation đầu tiên
      convRepo.create(created.id, 'Hội thoại ban đầu');
      return created;
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_OPEN],
    ({ id }) => {
      const project = projectRepo.getById(id);
      if (!project) {
        throw new Error(`Không tìm thấy dự án với id: ${id}`);
      }
      projectRepo.touchLastOpened(id);
      return project;
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_VALIDATE_PATH],
    ({ path: checkPath }) => validateProjectPath(checkPath),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECTS_PICK_FOLDER],
    async () => {
      if (deps.pickFolderDialog) {
        return deps.pickFolderDialog();
      }
      return { canceled: true, folderPath: null };
    },
    ipcLogger,
  );

  // === CONVERSATIONS (PHASE 3) ===
  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_LIST],
    ({ projectId }) => convRepo.listByProject(projectId),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_GET],
    ({ id }) => convRepo.getById(id),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_CREATE],
    ({ projectId, title }) => convRepo.create(projectId, title),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_MESSAGES],
    ({ conversationId }) => convRepo.listMessages(conversationId),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CONVERSATIONS_STEPS],
    ({ conversationId }) => {
      const steps = convRepo.listSteps(conversationId);
      return steps.map((s) => mapStepToVm(s, agentRegistry, modelsService, decisionRepo, convRepo));
    },
    ipcLogger,
  );

  // === ORCHESTRATOR (PHASE 3) ===
  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.ORCHESTRATOR_SEND],
    async ({ conversationId, prompt, aiPick }) => {
      await orchestrator.send({ conversationId, prompt, aiPick });
      return { started: true };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.ORCHESTRATOR_CANCEL],
    async ({ conversationId }) => {
      orchestrator.cancel(conversationId);
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.ORCHESTRATOR_SET_AI_PICK],
    async ({ conversationId, aiPick }) => {
      orchestrator.setAiPick(conversationId, aiPick);
    },
    ipcLogger,
  );

  // === PERMISSIONS (PHASE 3) ===
  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PERMISSION_RESPOND],
    async ({ conversationId, requestId, allowed }) => {
      orchestrator.respondPermission(conversationId, requestId, allowed);
    },
    ipcLogger,
  );
}

export const registerPhase1IpcHandlers = registerIpcHandlers;
