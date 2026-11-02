import path from 'node:path';
import { IPC_CHANNELS, IPC_CONTRACTS, type AgentId, type StepVM } from '@shared/ipc';
import { AgentRegistry } from '../agents/detect';
import { ModelTierService } from '../agents/models';
import { AgentSessionRepository } from '../agents/session-repo';
import { CheckpointRepository } from '../db/checkpoint-repo';
import { ConversationRepository, type StepRecord } from '../db/conversation-repo';
import type { DatabaseService } from '../db/database';
import { DecisionRepository } from '../db/decision-repo';
import { ProjectMapRepository } from '../db/project-map-repo';
import { ProjectRepository } from '../db/project-repo';
import { QuotaRepository } from '../db/quota-repo';
import { SettingsRepository } from '../db/settings-repo';
import { StepFilesRepository } from '../db/step-files-repo';
import { UserEditsRepository } from '../db/user-edits-repo';
import type { Logger } from '../logger/logger';
import { Orchestrator } from '../orchestrator/orchestrator';
import { ConflictDetector } from '../project/conflict-detector';
import { EditableScanner } from '../project/editable-scanner';
import { PreviewServerService } from '../project/preview-server';
import { ShadowGitService } from '../project/shadow-git';
import { QuotaService } from '../quota/quota-service';
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
  readonly quotaRepo?: QuotaRepository;
  readonly quotaService?: QuotaService;
  readonly projectRepo?: ProjectRepository;
  readonly convRepo?: ConversationRepository;
  readonly decisionRepo?: DecisionRepository;
  readonly stepFilesRepo?: StepFilesRepository;
  readonly userEditsRepo?: UserEditsRepository;
  readonly projectMapRepo?: ProjectMapRepository;
  readonly checkpointRepo?: CheckpointRepository;
  readonly previewServer?: PreviewServerService;
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
  const stepFilesRepo = deps.stepFilesRepo ?? new StepFilesRepository(db);
  const userEditsRepo = deps.userEditsRepo ?? new UserEditsRepository(db);
  const projectMapRepo = deps.projectMapRepo ?? new ProjectMapRepository(db);
  const checkpointRepo = deps.checkpointRepo ?? new CheckpointRepository(db);
  const previewServer = deps.previewServer ?? new PreviewServerService();
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

  const quotaRepo = deps.quotaRepo ?? new QuotaRepository(db);
  const quotaService =
    deps.quotaService ?? new QuotaService(quotaRepo, settingsRepo, agentRegistry);

  const orchestrator =
    deps.orchestrator ??
    new Orchestrator({
      registry: agentRegistry,
      modelService: modelsService,
      convRepo,
      projRepo: projectRepo,
      decisionRepo,
      settingsRepo,
      quotaService,
      logger: deps.logger.child('orchestrator'),
    });

  // Lắng nghe sự kiện từ Orchestrator và broadcast xuống renderer
  orchestrator.on('event', (payload) => {
    if (deps.broadcastEvent) {
      deps.broadcastEvent('codefleet:orchestrator:event', payload);
    }
  });

  // Lắng nghe cập nhật quota và broadcast xuống renderer (PLAN 6.6, UI_SPEC 3.2)
  quotaService.subscribe((snapshots) => {
    if (deps.broadcastEvent) {
      deps.broadcastEvent('codefleet:quota:update', snapshots);
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

  // === PHASE 4: CODE VIEW, DIFF, SAFETY NET & PREVIEW ===
  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CODE_STEP_DIFF],
    ({ stepId }) => {
      const step = convRepo.getStepById(stepId);
      const files = stepFilesRepo.listByStep(stepId);
      const whyApproach = decisionRepo.getLatestForStep(stepId, 'approach')?.text ?? null;
      let fullDiff: string | null = null;
      if (files.length > 0) {
        fullDiff = files
          .map((f) => `--- a/${f.path}\n+++ b/${f.path}\n${f.fullDiff ?? ''}`)
          .join('\n\n');
      }
      return {
        stepId,
        summary: step?.summary ?? null,
        fullDiff,
        files: files.map((f) => ({
          id: f.id,
          path: f.path,
          change: f.change,
          riskTags: f.riskTags ? [...f.riskTags] : null,
          diffSummary: f.diffSummary,
          fullDiff: f.fullDiff,
        })),
        whyApproach,
      };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CODE_EXPLAIN_SEGMENT],
    ({ codeSnippet }) => {
      const trimmed = codeSnippet.trim();
      const firstLine = trimmed.split('\n')[0] || '';
      return {
        explanation: `Đoạn mã này thực hiện: "${firstLine.slice(0, 80)}". Đây là phần xử lý giao diện/dữ liệu cục bộ được viết bởi AI theo yêu cầu của bạn.`,
      };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CHECKPOINT_UNDO_STEP],
    ({ stepId }) => {
      const step = convRepo.getStepById(stepId);
      if (!step) {
        throw new Error(`Step not found: ${stepId}`);
      }
      convRepo.updateStepStatus(stepId, 'undone');
      const files = stepFilesRepo.listByStep(stepId);

      const conv = convRepo.getById(step.conversationId);
      if (conv) {
        const proj = projectRepo.getById(conv.projectId);
        if (proj && step.checkpointBefore) {
          const shadowGit = new ShadowGitService({
            workTree: proj.path,
            shadowGitDir: path.join(deps.userDataDir, 'projects', proj.id, 'shadow.git'),
          });
          shadowGit.restoreCheckpoint(step.checkpointBefore);
        }
      }

      return {
        undoneStepId: stepId,
        affectedFiles: files.map((f) => f.path),
        dependentStepsCount: 0,
      };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.CHECKPOINT_REDO_STEP],
    ({ stepId }) => {
      const step = convRepo.getStepById(stepId);
      if (!step) {
        throw new Error(`Step not found: ${stepId}`);
      }
      convRepo.updateStepStatus(stepId, 'done');

      const conv = convRepo.getById(step.conversationId);
      if (conv) {
        const proj = projectRepo.getById(conv.projectId);
        if (proj && step.checkpointAfter) {
          const shadowGit = new ShadowGitService({
            workTree: proj.path,
            shadowGitDir: path.join(deps.userDataDir, 'projects', proj.id, 'shadow.git'),
          });
          shadowGit.restoreCheckpoint(step.checkpointAfter);
        }
      }

      return {
        redoneStepId: stepId,
      };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECT_EDITABLES],
    ({ projectId }) => {
      const proj = projectRepo.getById(projectId);
      if (!proj) return [];
      return EditableScanner.scanProject(proj.path);
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.USER_EDITS_SAVE_DIRECT],
    ({ projectId, filePath, locator, newValue }) => {
      const proj = projectRepo.getById(projectId);
      if (!proj) throw new Error('Project not found');

      const editRes = EditableScanner.applyEdit(proj.path, filePath, locator, newValue);
      if (!editRes.ok) {
        throw new Error(editRes.error || 'Failed to apply direct edit');
      }

      userEditsRepo.recordEdit({
        projectId,
        path: filePath,
        contentHash: editRes.newContentHash,
      });

      const shadowGit = new ShadowGitService({
        workTree: proj.path,
        shadowGitDir: path.join(deps.userDataDir, 'projects', proj.id, 'shadow.git'),
      });
      const hash = shadowGit.createCheckpoint(`Người dùng tự sửa: ${filePath}`);
      checkpointRepo.create({
        projectId,
        gitHash: hash,
        description: `Tự sửa file: ${filePath}`,
      });

      return {
        ok: true,
        newContentHash: editRes.newContentHash,
      };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECT_CONFLICT_RESOLVE],
    ({ projectId, stepId, filePath, choice, userVersion, aiVersion }) => {
      const proj = projectRepo.getById(projectId);
      if (!proj) throw new Error('Project not found');

      const res = ConflictDetector.resolveConflict({
        choice,
        projectDir: proj.path,
        relPath: filePath,
        userVersion,
        aiVersion,
        userEditsRepo,
        projectId,
      });

      convRepo.updateStepStatus(stepId, 'done');
      return { ok: res.ok };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECT_HISTORY],
    ({ projectId }) => {
      const convs = convRepo.listByProject(projectId);
      const allSteps: StepVM[] = [];
      for (const c of convs) {
        const steps = convRepo.listSteps(c.id);
        allSteps.push(
          ...steps.map((s) => mapStepToVm(s, agentRegistry, modelsService, decisionRepo, convRepo)),
        );
      }
      const userEdits = userEditsRepo.listByProject(projectId);
      const decisions = decisionRepo.listByProject(projectId);

      return {
        steps: allSteps,
        userEdits: userEdits.map((e) => ({
          id: e.id,
          path: e.path,
          editedAt: e.editedAt,
        })),
        decisions: decisions.map((d) => ({
          id: d.id,
          stepId: d.stepId,
          kind: d.kind,
          text: d.text,
          createdAt: d.createdAt,
        })),
      };
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PROJECT_MAP],
    ({ projectId }) => {
      const mapItems = projectMapRepo.listByProject(projectId);
      return mapItems.map((m) => ({
        id: m.id,
        feature: m.feature,
        description: m.description,
        files: [...m.files],
        isSensitive: m.isSensitive,
        updatedAt: m.updatedAt,
      }));
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PREVIEW_STATUS],
    ({ projectId }) => {
      const proj = projectRepo.getById(projectId);
      if (!proj) return { isWebProject: false, isRunning: false, url: null, error: null };
      return previewServer.getStatus(projectId, proj.path);
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PREVIEW_START],
    async ({ projectId }) => {
      const proj = projectRepo.getById(projectId);
      if (!proj) return { ok: false, url: null, error: 'Project not found' };
      return previewServer.start(projectId, proj.path);
    },
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.PREVIEW_STOP],
    ({ projectId }) => {
      previewServer.stop(projectId);
    },
    ipcLogger,
  );

  // === QUOTA (PHASE 5: MH-08, PLAN 6.6, ADR-018) ===
  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.QUOTA_GET_ALL],
    () => quotaService.getAllLatest(),
    ipcLogger,
  );

  registerTypedHandler(
    registrar,
    IPC_CONTRACTS[IPC_CHANNELS.QUOTA_REFRESH],
    async () => quotaService.refreshPassive(),
    ipcLogger,
  );
}

export const registerPhase1IpcHandlers = registerIpcHandlers;
