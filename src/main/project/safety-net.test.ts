import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from '../db/database';
import { UserEditsRepository } from '../db/user-edits-repo';
import { ConflictDetector } from './conflict-detector';
import { EditableScanner } from './editable-scanner';
import { ShadowGitService } from './shadow-git';

describe('Safety Net: EditableScanner & ConflictDetector (MH-05, MH-06, Luật U5, PLAN 4.7)', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let userEditsRepo: UserEditsRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-safety-test-'));
    dbService = new DatabaseService({ userDataDir: tempDir });
    const db = dbService.openAndMigrate();
    userEditsRepo = new UserEditsRepository(db);
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

  it('EditableScanner scans HTML text, CSS color, and JSON number correctly', () => {
    const projectDir = path.join(tempDir, 'sample-project');
    fs.mkdirSync(projectDir, { recursive: true });

    // Tạo file HTML mẫu
    fs.writeFileSync(
      path.join(projectDir, 'index.html'),
      '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Tiệm Bánh Ngon</h1>\n  <button>Đặt ngay</button>\n</body>\n</html>',
      'utf8',
    );

    // Tạo file CSS mẫu
    fs.writeFileSync(
      path.join(projectDir, 'styles.css'),
      'body {\n  background-color: #f7f9f8;\n  color: #10a37f;\n}',
      'utf8',
    );

    // Tạo file JSON dữ liệu mẫu
    fs.writeFileSync(
      path.join(projectDir, 'data.json'),
      '{\n  "cakePrice": 50000,\n  "quantity": 10\n}',
      'utf8',
    );

    const items = EditableScanner.scanProject(projectDir);
    expect(items.length).toBeGreaterThanOrEqual(4);

    const textItem = items.find((i) => i.kind === 'text' && i.value === 'Tiệm Bánh Ngon');
    expect(textItem).toBeDefined();
    expect(textItem?.file).toBe('index.html');
    expect(textItem?.locator.line).toBe(4);

    const colorItem = items.find((i) => i.kind === 'color' && i.value.toLowerCase() === '#f7f9f8');
    expect(colorItem).toBeDefined();

    const numberItem = items.find((i) => i.kind === 'number' && i.value === '50000');
    expect(numberItem).toBeDefined();
  });

  it('EditableScanner applies byte-accurate edits without touching the rest of the file', () => {
    const projectDir = path.join(tempDir, 'edit-project');
    fs.mkdirSync(projectDir, { recursive: true });

    const originalContent = '<h1>Tiệm Bánh Ngon</h1>\n<p>Bánh tươi mỗi ngày</p>\n';
    fs.writeFileSync(path.join(projectDir, 'index.html'), originalContent, 'utf8');

    const items = EditableScanner.scanHtmlJsx(projectDir, 'index.html');
    const h1Item = items.find((i) => i.value === 'Tiệm Bánh Ngon')!;

    const res = EditableScanner.applyEdit(
      projectDir,
      'index.html',
      h1Item.locator,
      'Tiệm Bánh Sài Gòn',
    );
    expect(res.ok).toBe(true);

    const updatedContent = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf8');
    expect(updatedContent).toBe('<h1>Tiệm Bánh Sài Gòn</h1>\n<p>Bánh tươi mỗi ngày</p>\n');
    // Phần thẻ <p> không hề bị ảnh hưởng
    expect(updatedContent.includes('<p>Bánh tươi mỗi ngày</p>')).toBe(true);
  });

  it('ConflictDetector flags a conflict when user edited a file that AI also modifies (MH-05)', () => {
    const projectDir = path.join(tempDir, 'conflict-project');
    const shadowDir = path.join(tempDir, 'shadow.git');
    fs.mkdirSync(projectDir, { recursive: true });

    const shadowGit = new ShadowGitService({
      workTree: projectDir,
      shadowGitDir: shadowDir,
    });
    shadowGit.init();

    const db = dbService.getDb();
    db.prepare('INSERT INTO projects (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
      'proj-1',
      'Conflict Test',
      projectDir,
      new Date().toISOString(),
    );

    // 1. Ban đầu có file header.html
    fs.writeFileSync(path.join(projectDir, 'header.html'), '<header>Logo Cũ</header>\n', 'utf8');
    const cpBefore = shadowGit.createCheckpoint('Trước bước');

    // 2. Người dùng tự sửa file header.html
    const userModified = '<header>Logo Người Dùng Sửa</header>\n';
    fs.writeFileSync(path.join(projectDir, 'header.html'), userModified, 'utf8');
    userEditsRepo.recordEdit({
      projectId: 'proj-1',
      path: 'header.html',
      contentHash: 'hash-user-1',
    });

    // 3. AI muốn ghi đè một bản khác
    const aiProposed = '<header>Logo AI Tạo Đẹp</header>\n';

    const conflict = ConflictDetector.checkConflict({
      projectId: 'proj-1',
      stepId: 'step-1',
      relPath: 'header.html',
      projectDir,
      aiProposedContent: aiProposed,
      checkpointBeforeHash: cpBefore,
      shadowGit,
      userEditsRepo,
    });

    expect(conflict).not.toBeNull();
    expect(conflict?.userVersion).toBe(userModified);
    expect(conflict?.aiVersion).toBe(aiProposed);
    expect(conflict?.plainExplain).toContain('Bạn đã tự sửa file này');

    // 4. Giải quyết xung đột: người dùng chọn keep_user
    const resolveRes = ConflictDetector.resolveConflict({
      choice: 'keep_user',
      projectDir,
      relPath: 'header.html',
      userVersion: userModified,
      aiVersion: aiProposed,
      userEditsRepo,
      projectId: 'proj-1',
    });

    expect(resolveRes.ok).toBe(true);
    const finalContent = fs.readFileSync(path.join(projectDir, 'header.html'), 'utf8');
    expect(finalContent).toBe(userModified);
  }, 20000);
});
