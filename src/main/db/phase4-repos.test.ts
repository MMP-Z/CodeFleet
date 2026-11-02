import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from './database';
import { CheckpointRepository } from './checkpoint-repo';
import { ProjectMapRepository } from './project-map-repo';
import { ProjectRepository } from './project-repo';
import { StepFilesRepository } from './step-files-repo';
import { UserEditsRepository } from './user-edits-repo';
import { ShadowGitService } from '../project/shadow-git';

describe('Phase 4 Repositories & ShadowGitService (ADR-006, ADR-020-023)', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let projectRepo: ProjectRepository;
  let stepFilesRepo: StepFilesRepository;
  let userEditsRepo: UserEditsRepository;
  let projectMapRepo: ProjectMapRepository;
  let checkpointRepo: CheckpointRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-p4-repo-'));
    dbService = new DatabaseService({ userDataDir: tempDir });
    const db = dbService.openAndMigrate();

    projectRepo = new ProjectRepository(db);
    stepFilesRepo = new StepFilesRepository(db);
    userEditsRepo = new UserEditsRepository(db);
    projectMapRepo = new ProjectMapRepository(db);
    checkpointRepo = new CheckpointRepository(db);
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('StepFilesRepository upserts diff information and risk tags correctly', () => {
    const proj = projectRepo.create({
      name: 'Tiệm Bánh',
      path: path.join(tempDir, 'project'),
    });

    // Tạo bước giả lập trong DB
    const db = dbService.getDb();
    const convId = 'conv-1';
    db.prepare('INSERT INTO conversations (id, project_id, title, created_at) VALUES (?, ?, ?, ?)').run(
      convId,
      proj.id,
      'Test Conv',
      new Date().toISOString(),
    );
    const stepId = 'step-1';
    db.prepare(`
      INSERT INTO steps (id, conversation_id, seq, agent_id, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(stepId, convId, 1, 'claude', 'done');

    const file = stepFilesRepo.upsert({
      stepId,
      path: 'src/index.html',
      change: 'added',
      riskTags: ['ui'],
      diffSummary: 'Thêm thẻ tiêu đề và nút đặt bánh',
      fullDiff: '+ <h1>Tiệm Bánh Nhỏ</h1>',
    });

    expect(file.id).toBeDefined();
    expect(file.change).toBe('added');
    expect(file.riskTags).toEqual(['ui']);
    expect(file.diffSummary).toBe('Thêm thẻ tiêu đề và nút đặt bánh');

    const list = stepFilesRepo.listByStep(stepId);
    expect(list).toHaveLength(1);
    expect(list[0].path).toBe('src/index.html');

    // Cập nhật lại
    stepFilesRepo.upsert({
      stepId,
      path: 'src/index.html',
      change: 'modified',
      diffSummary: 'Đổi tiêu đề',
      fullDiff: '+ <h1>Tiệm Bánh Nhỏ Sài Gòn</h1>',
    });

    const updated = stepFilesRepo.getByPath(stepId, 'src/index.html');
    expect(updated?.change).toBe('modified');
    expect(updated?.diffSummary).toBe('Đổi tiêu đề');
  });

  it('UserEditsRepository tracks user manual changes with content hashes', () => {
    const proj = projectRepo.create({
      name: 'Portfolio',
      path: path.join(tempDir, 'portfolio'),
    });

    const edit = userEditsRepo.recordEdit({
      projectId: proj.id,
      path: 'styles.css',
      contentHash: 'hash-abc-123',
    });

    expect(edit.id).toBeDefined();
    expect(edit.path).toBe('styles.css');

    const latest = userEditsRepo.getLatestForFile(proj.id, 'styles.css');
    expect(latest?.contentHash).toBe('hash-abc-123');

    const all = userEditsRepo.listByProject(proj.id);
    expect(all).toHaveLength(1);
  });

  it('ProjectMapRepository saves and retrieves functional file groups (ADR-015, ADR-023)', () => {
    const proj = projectRepo.create({
      name: 'App Web',
      path: path.join(tempDir, 'web'),
    });

    projectMapRepo.upsertFeature({
      projectId: proj.id,
      feature: 'Trang chủ & Menu',
      description: 'Chứa banner và danh sách món',
      files: ['index.html', 'menu.js'],
      isSensitive: false,
    });

    const items = projectMapRepo.listByProject(proj.id);
    expect(items).toHaveLength(1);
    expect(items[0].feature).toBe('Trang chủ & Menu');
    expect(items[0].files).toEqual(['index.html', 'menu.js']);
  });

  it('CheckpointRepository saves git commit hashes per step', () => {
    const proj = projectRepo.create({
      name: 'App Web 2',
      path: path.join(tempDir, 'web2'),
    });

    const cp = checkpointRepo.create({
      projectId: proj.id,
      gitHash: 'sha256-commit-1',
      description: 'Sau bước 1: Tạo layout',
    });

    expect(cp.gitHash).toBe('sha256-commit-1');
    const latest = checkpointRepo.getLatestForProject(proj.id);
    expect(latest?.gitHash).toBe('sha256-commit-1');
  });

  it('ShadowGitService initializes, creates checkpoints, and restores cleanly without user .git pollution', () => {
    const projectDir = path.join(tempDir, 'user-project');
    const shadowDir = path.join(tempDir, 'shadow.git');
    fs.mkdirSync(projectDir, { recursive: true });

    // Tạo file dự án của người dùng
    fs.writeFileSync(path.join(projectDir, 'README.md'), '# Dự án thử nghiệm\n', 'utf8');

    const shadowGit = new ShadowGitService({
      workTree: projectDir,
      shadowGitDir: shadowDir,
    });
    shadowGit.init();

    // Xác nhận không tạo .git trong projectDir của người dùng
    expect(fs.existsSync(path.join(projectDir, '.git'))).toBe(false);

    // Tạo checkpoint 1
    const cp1 = shadowGit.createCheckpoint('Bước 1: Khởi tạo README');
    expect(cp1).toHaveLength(40); // 40-char git commit SHA

    // Người dùng hoặc AI thêm file mới
    fs.writeFileSync(path.join(projectDir, 'index.html'), '<h1>Hello</h1>\n', 'utf8');
    const cp2 = shadowGit.createCheckpoint('Bước 2: Thêm index.html');

    // Kiểm tra danh sách thay đổi giữa cp1 và cp2
    const changes = shadowGit.getChangedFiles(cp1, cp2);
    expect(changes.some((c) => c.path.includes('index.html'))).toBe(true);

    // Hoàn tác về checkpoint 1
    shadowGit.restoreCheckpoint(cp1);
    expect(fs.existsSync(path.join(projectDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'index.html'))).toBe(false);
  });
});
