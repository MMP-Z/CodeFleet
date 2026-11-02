import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentAdapter, AgentEvent, AgentId, AgentSession } from '../agents/types';
import { AgentRegistry } from '../agents/detect';
import { ModelTierService } from '../agents/models';
import { AgentSessionRepository } from '../agents/session-repo';
import { DatabaseService } from '../db/database';
import { ConversationRepository } from '../db/conversation-repo';
import { DecisionRepository } from '../db/decision-repo';
import { ProjectRepository } from '../db/project-repo';
import { Orchestrator } from './orchestrator';
import { Planner } from './planner';
import { Router } from './router';
import type { RouteContext, SelectedUnit } from './types';

// Mock adapter helper
function createMockAdapter(
  id: string,
  displayName: string,
  color: string,
  eventsToEmit: AgentEvent[],
): AgentAdapter {
  const shortName = displayName.split(' ')[0] ?? displayName;
  const agentId = id as AgentId;

  return {
    id: agentId,
    displayName,
    shortName,
    logoLetter: displayName[0] ?? 'A',
    color,
    darkColor: color,
    docsUrl: 'https://example.com',
    installCommand: 'echo install',
    loginCommand: 'echo login',
    detect: async () => ({
      agentId,
      displayName,
      shortName,
      logoLetter: displayName[0] ?? 'A',
      color,
      darkColor: color,
      docsUrl: 'https://example.com',
      installCommand: 'echo install',
      loginCommand: 'echo login',
      installed: true,
      version: '1.0.0',
      loggedIn: true,
      status: 'ready',
      errorDetail: null,
      modelsCount: 3,
    }),
    listModels: async () => [
      {
        id: `${id}-opus`,
        agentId,
        agentDisplayName: displayName,
        label: `${displayName} Strong`,
        tier: 'strong' as const,
        tierSource: 'default' as const,
      },
      {
        id: `${id}-sonnet`,
        agentId,
        agentDisplayName: displayName,
        label: `${displayName} Balanced`,
        tier: 'balanced' as const,
        tierSource: 'default' as const,
      },
      {
        id: `${id}-haiku`,
        agentId,
        agentDisplayName: displayName,
        label: `${displayName} Fast`,
        tier: 'fast' as const,
        tierSource: 'default' as const,
      },
    ],
    startSession: async (opts) => {
      const session: AgentSession = {
        id: 'sess-mock',
        agentId,
        cwd: opts.cwd,
        model: opts.model ?? null,
        getExternalSessionId: () => null,
        send: async (_prompt: string, onEvent: (e: AgentEvent) => void) => {
          setTimeout(() => {
            for (const e of eventsToEmit) {
              onEvent(e);
            }
          }, 10);
        },
        respondPermission: async () => {},
        cancel: async () => {},
      };
      return session;
    },
    getQuota: async () => [],
  };
}

describe('Phase 3 Orchestrator: Planner, Router v1, and Executor', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let projRepo: ProjectRepository;
  let convRepo: ConversationRepository;
  let decisionRepo: DecisionRepository;
  let modelService: ModelTierService;
  let registry: AgentRegistry;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-orch-test-'));
    dbService = new DatabaseService({ userDataDir: tempDir });
    dbService.openAndMigrate();
    const db = dbService.getDb();

    projRepo = new ProjectRepository(db);
    convRepo = new ConversationRepository(db);
    decisionRepo = new DecisionRepository(db);
    modelService = new ModelTierService({
      db,
      userDataDir: tempDir,
    });
    const sessionRepo = new AgentSessionRepository(db);
    registry = new AgentRegistry({
      modelsService: modelService,
      sessionRepo,
      customAdapters: [],
    });
  });

  afterEach(() => {
    dbService.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Planner', () => {
    it('plans steps for a general landing page request', async () => {
      const planner = new Planner();
      const steps = await planner.plan('Làm cho tôi trang landing đơn giản');

      expect(steps.length).toBe(3);
      expect(steps[0]?.seq).toBe(1);
      expect(steps[0]?.kind).toBe('scaffold');
      expect(steps[0]?.requiredTier).toBe('balanced');

      expect(steps[1]?.seq).toBe(2);
      expect(steps[1]?.kind).toBe('styling');
      expect(steps[1]?.requiredTier).toBe('fast');

      expect(steps[2]?.seq).toBe(3);
      expect(steps[2]?.kind).toBe('feature');
    });

    it('identifies sensitive steps for payment and enforces strong tier (Luật PLAN 4.5a)', async () => {
      const planner = new Planner();
      const steps = await planner.plan('Tạo giỏ hàng và xử lý thanh toán');

      const paymentStep = steps.find((s) => s.kind === 'sensitive');
      expect(paymentStep).toBeDefined();
      expect(paymentStep?.requiredTier).toBe('strong');
      expect(paymentStep?.riskLevel).toBe('high');
      expect(paymentStep?.riskTags).toContain('payment');
    });
  });

  describe('Router v1 (Chuỗi dự phòng & Bậc model)', () => {
    it('refuses to downgrade tier for high-risk steps when rate limited (PLAN 4.5a)', async () => {
      const claudeAdapter = createMockAdapter('claude', 'Claude Code', '#C2603A', []);
      const codexAdapter = createMockAdapter('codex', 'Codex CLI', '#10A37F', []);
      registry.register(claudeAdapter);
      registry.register(codexAdapter);

      const router = new Router(registry, modelService);

      const sensitiveStep = {
        seq: 2,
        title: 'Thanh toán trực tuyến',
        summary: 'Xử lý thanh toán',
        kind: 'sensitive' as const,
        requiredTier: 'strong' as const,
        riskLevel: 'high' as const,
        riskTags: ['payment'],
      };

      const currentUnit: SelectedUnit = {
        agentId: 'claude',
        agentDisplayName: 'Claude Code',
        agentColor: '#C2603A',
        modelId: 'claude-opus',
        modelLabel: 'Claude Code Strong',
        tier: 'strong',
      };

      const context: RouteContext = {
        requiredTier: 'strong',
        riskLevel: 'high',
      };

      // Khi Claude Strong bị rate limit, cùng CLI có `claude-haiku`/`claude-sonnet` nhưng vì bước này nhạy cảm (high-risk),
      // Router KHÔNG ĐƯỢC hạ bậc sang claude-haiku, mà PHẢI chuyển sang codex-opus (strong)!
      const switchResult = await router.switchOnRateLimit(sensitiveStep, currentUnit, context);

      expect(switchResult).not.toBeNull();
      expect(switchResult?.unit.agentId).toBe('codex');
      expect(switchResult?.unit.tier).toBe('strong');
      expect(switchResult?.decisionKind).toBe('switch');
      expect(switchResult?.decisionText).toContain('nhạy cảm nên không hạ bậc model');
    });

    it('returns null and pauses when all available units are exhausted', async () => {
      const claudeAdapter = createMockAdapter('claude', 'Claude Code', '#C2603A', []);
      registry.register(claudeAdapter);
      const router = new Router(registry, modelService);

      const step = {
        seq: 1,
        title: 'Bước đơn giản',
        summary: 'Tạo HTML',
        kind: 'scaffold' as const,
        requiredTier: 'fast' as const,
        riskLevel: 'low' as const,
        riskTags: [],
      };

      const currentUnit: SelectedUnit = {
        agentId: 'claude',
        agentDisplayName: 'Claude Code',
        agentColor: '#C2603A',
        modelId: 'claude-haiku',
        modelLabel: 'Claude Fast',
        tier: 'fast',
      };

      // Đánh dấu toàn bộ các model của claude đã hết hạn mức
      const context: RouteContext = {
        requiredTier: 'fast',
        riskLevel: 'low',
        exhaustedUnits: new Set([
          'claude:claude-opus',
          'claude:claude-sonnet',
          'claude:claude-haiku',
        ]),
      };

      const result = await router.switchOnRateLimit(step, currentUnit, context);
      expect(result).toBeNull();
    });
  });

  describe('Orchestrator Execution & Safety Laws (B4, B5, Cancel)', () => {
    it('executes a prompt, logs decisions, and blocks writes outside project (Luật B4)', async () => {
      const projectRoot = path.join(tempDir, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const events: AgentEvent[] = [
        {
          type: 'file_change',
          path: path.join(projectRoot, 'index.html'),
        },
        // Cố ghi ra ngoài thư mục dự án (Luật B4)
        {
          type: 'file_change',
          path: path.join(tempDir, 'outside-secret.txt'),
        },
        {
          type: 'done',
        },
      ];

      const adapter = createMockAdapter('claude', 'Claude Code', '#C2603A', events);
      registry.register(adapter);

      const orchestrator = new Orchestrator({
        registry,
        modelService,
        convRepo,
        projRepo,
        decisionRepo,
      });

      const proj = projRepo.create({ name: 'App', path: projectRoot });
      const conv = convRepo.create(proj.id, 'Chat');

      const systemLines: string[] = [];
      const donePromise = new Promise<void>((resolve) => {
        orchestrator.on('event', (e) => {
          if (e.type === 'system_line') {
            systemLines.push((e.data as { text: string }).text);
          }
          if (e.type === 'execution_done') {
            resolve();
          }
        });
      });

      await orchestrator.send({
        conversationId: conv.id,
        prompt: 'Làm cho tôi trang landing đơn giản',
      });

      // Chờ toàn bộ các bước hoàn thành
      await donePromise;

      // Kiểm tra quyết định được ghi lại
      const decisions = decisionRepo.listByProject(proj.id);
      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0]?.kind).toBe('pick');

      // Kiểm tra cảnh báo Luật B4 được phát ra
      expect(
        systemLines.some((line) => line.includes('Đã chặn AI ghi ra ngoài thư mục dự án')),
      ).toBe(true);

      // File hợp lệ được ghi nhận trong DB
      const steps = convRepo.listSteps(conv.id);
      const step1 = steps[0]!;
      const files = convRepo.listStepFiles(step1.id);
      expect(files.some((f) => f.path.includes('index.html'))).toBe(true);
      expect(files.some((f) => f.path.includes('outside-secret'))).toBe(false);
    });

    it('cancels ongoing execution when cancel() is called', async () => {
      const projectRoot = path.join(tempDir, 'cancel-project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const adapter = createMockAdapter('claude', 'Claude Code', '#C2603A', []);
      registry.register(adapter);

      const orchestrator = new Orchestrator({
        registry,
        modelService,
        convRepo,
        projRepo,
        decisionRepo,
      });

      const proj = projRepo.create({ name: 'Cancel App', path: projectRoot });
      const conv = convRepo.create(proj.id, 'Chat');

      void orchestrator.send({
        conversationId: conv.id,
        prompt: 'Làm việc',
      });

      // Đợi ngắn để executor khởi tạo và ghi nhận steps
      await new Promise((r) => setTimeout(r, 20));

      // Huỷ
      orchestrator.cancel(conv.id);

      await new Promise((r) => setTimeout(r, 50));

      const steps = convRepo.listSteps(conv.id);
      expect(steps.some((s) => s.status === 'pending')).toBe(true);
    });
  });
});
