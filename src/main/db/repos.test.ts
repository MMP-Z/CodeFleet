import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from './database';
import { ConversationRepository } from './conversation-repo';
import { DecisionRepository } from './decision-repo';
import { ProjectRepository } from './project-repo';

describe('Phase 3 Repositories (Project, Conversation, Step, Decision)', () => {
  let tempDir: string;
  let dbService: DatabaseService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-repos-test-'));
    dbService = new DatabaseService({
      userDataDir: tempDir,
    });
    dbService.openAndMigrate();
  });

  afterEach(() => {
    dbService.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ProjectRepository', () => {
    it('creates, lists, touches last_opened, and deletes a project', () => {
      const repo = new ProjectRepository(dbService.getDb());

      const p1 = repo.create({
        name: 'Dự án Landing Page',
        path: 'D:/projects/landing',
      });
      expect(p1.id).toBeDefined();
      expect(p1.name).toBe('Dự án Landing Page');
      expect(p1.lastOpened).not.toBeNull();

      const p2 = repo.create({
        name: 'Dự án Blog',
        path: 'D:/projects/blog',
      });

      const list = repo.list();
      expect(list.length).toBe(2);
      expect(list.map((p) => p.name)).toContain('Dự án Landing Page');
      expect(list.map((p) => p.name)).toContain('Dự án Blog');

      // Tìm theo path
      const found = repo.getByPath('D:/projects/landing');
      expect(found?.id).toBe(p1.id);

      // Cập nhật tên
      repo.updateName(p1.id, 'Dự án Landing Page V2');
      const updated = repo.getById(p1.id);
      expect(updated?.name).toBe('Dự án Landing Page V2');

      // Xoá
      repo.delete(p2.id);
      expect(repo.getById(p2.id)).toBeNull();
      expect(repo.list().length).toBe(1);
    });
  });

  describe('ConversationRepository', () => {
    it('manages conversations, messages, steps and step files', () => {
      const db = dbService.getDb();
      const projRepo = new ProjectRepository(db);
      const convRepo = new ConversationRepository(db);

      const proj = projRepo.create({
        name: 'Test App',
        path: 'D:/projects/test',
      });

      // 1. Tạo conversation
      const conv = convRepo.create(proj.id, 'Hội thoại ban đầu');
      expect(conv.projectId).toBe(proj.id);
      expect(conv.title).toBe('Hội thoại ban đầu');

      const convList = convRepo.listByProject(proj.id);
      expect(convList.length).toBe(1);
      expect(convList[0]?.id).toBe(conv.id);

      // 2. Thêm messages
      convRepo.addMessage(conv.id, 'user', 'Làm cho tôi trang chủ');
      convRepo.addMessage(conv.id, 'assistant', 'Tôi đã chia thành 2 bước');

      const messages = convRepo.listMessages(conv.id);
      expect(messages.length).toBe(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');

      // 3. Tạo steps
      const createdSteps = convRepo.createSteps(conv.id, [
        {
          seq: 1,
          agentId: 'claude',
          model: 'claude-sonnet-4-5',
          status: 'pending',
          summary: 'Tạo khung HTML',
          riskLevel: 'low',
        },
        {
          seq: 2,
          agentId: 'gemini',
          model: 'gemini-2-5-pro',
          status: 'pending',
          summary: 'Thêm CSS và giao diện',
          riskLevel: 'medium',
        },
      ]);

      expect(createdSteps.length).toBe(2);
      expect(createdSteps[0]?.seq).toBe(1);
      expect(createdSteps[1]?.seq).toBe(2);

      const step1 = createdSteps[0]!;

      // 4. Bắt đầu step
      convRepo.setStepStarted(step1.id);
      let s1 = convRepo.getStepById(step1.id);
      expect(s1?.status).toBe('running');
      expect(s1?.startedAt).not.toBeNull();

      // 5. Thêm step files
      convRepo.addStepFiles(step1.id, [
        {
          path: 'index.html',
          change: 'added',
          riskTags: ['user_data'],
        },
      ]);

      const files = convRepo.listStepFiles(step1.id);
      expect(files.length).toBe(1);
      expect(files[0]?.path).toBe('index.html');
      expect(files[0]?.change).toBe('added');
      expect(files[0]?.riskTags).toEqual(['user_data']);

      // 6. Hoàn thành step
      convRepo.updateStepStatus(step1.id, 'done', {
        summary: 'Đã tạo khung HTML hoàn chỉnh',
        finishedAt: new Date().toISOString(),
      });

      s1 = convRepo.getStepById(step1.id);
      expect(s1?.status).toBe('done');
      expect(s1?.summary).toBe('Đã tạo khung HTML hoàn chỉnh');
    });
  });

  describe('DecisionRepository', () => {
    it('records decisions and queries by project, step and kind', () => {
      const db = dbService.getDb();
      const projRepo = new ProjectRepository(db);
      const convRepo = new ConversationRepository(db);
      const decisionRepo = new DecisionRepository(db);

      const proj = projRepo.create({
        name: 'Decision Project',
        path: 'D:/projects/decision',
      });
      const conv = convRepo.create(proj.id, 'Chat');
      const [step] = convRepo.createSteps(conv.id, [
        { seq: 1, agentId: 'claude', summary: 'Bước 1' },
      ]);

      // Ghi quyết định pick
      const d1 = decisionRepo.add({
        projectId: proj.id,
        stepId: step!.id,
        kind: 'pick',
        text: 'Chọn Claude Sonnet vì việc tạo HTML cần cân bằng',
      });
      expect(d1.id).toBeDefined();

      // Ghi quyết định switch khi rate limit
      const d2 = decisionRepo.add({
        projectId: proj.id,
        stepId: step!.id,
        kind: 'switch',
        text: 'Claude hết hạn mức, chuyển sang Gemini Pro',
      });
      expect(d2.kind).toBe('switch');

      // Query
      const projectDecisions = decisionRepo.listByProject(proj.id);
      expect(projectDecisions.length).toBe(2);

      const stepDecisions = decisionRepo.listByStep(step!.id);
      expect(stepDecisions.length).toBe(2);

      const latestSwitch = decisionRepo.getLatestForStep(step!.id, 'switch');
      expect(latestSwitch?.text).toContain('chuyển sang Gemini Pro');
    });
  });
});
