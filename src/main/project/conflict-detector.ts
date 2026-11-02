import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ConflictResolutionChoice, FileConflictVM } from '../../shared/ipc';
import type { UserEditsRepository } from '../db/user-edits-repo';
import type { ShadowGitService } from './shadow-git';

export type FileConflict = FileConflictVM;

export class ConflictDetector {
  public static checkConflict(input: {
    readonly projectId: string;
    readonly stepId: string;
    readonly relPath: string;
    readonly projectDir: string;
    readonly aiProposedContent: string;
    readonly checkpointBeforeHash: string | null;
    readonly shadowGit: ShadowGitService;
    readonly userEditsRepo: UserEditsRepository;
  }): FileConflict | null {
    const fullPath = path.join(input.projectDir, input.relPath);
    if (!fs.existsSync(fullPath)) {
      // File chưa tồn tại trên đĩa thì không có xung đột người dùng tự sửa
      return null;
    }

    const currentDiskContent = fs.readFileSync(fullPath, 'utf8');
    const currentHash = crypto.createHash('sha256').update(currentDiskContent).digest('hex');

    // Kiểm tra xem người dùng có từng sửa file này không
    const latestUserEdit = input.userEditsRepo.getLatestForFile(input.projectId, input.relPath);
    if (!latestUserEdit) {
      return null;
    }

    // Nếu nội dung hiện tại khác bản AI đề xuất và người dùng đã từng sửa file này
    const aiHash = crypto.createHash('sha256').update(input.aiProposedContent).digest('hex');
    if (currentHash === aiHash) {
      // Nội dung giống hệt nhau, không có xung đột
      return null;
    }

    // Có xung đột thực sự!
    const explain = `Bạn đã tự sửa file này vào lúc ${new Date(
      latestUserEdit.editedAt,
    ).toLocaleTimeString(
      'vi-VN',
    )}. AI muốn ghi nội dung mới, app dừng lại để bạn chọn phương án an toàn nhất.`;

    return {
      projectId: input.projectId,
      stepId: input.stepId,
      filePath: input.relPath,
      userEditedAt: latestUserEdit.editedAt,
      userVersion: currentDiskContent,
      aiVersion: input.aiProposedContent,
      plainExplain: explain,
    };
  }

  public static resolveConflict(input: {
    readonly choice: ConflictResolutionChoice;
    readonly projectDir: string;
    readonly relPath: string;
    readonly userVersion: string;
    readonly aiVersion: string;
    readonly userEditsRepo: UserEditsRepository;
    readonly projectId: string;
  }): { ok: boolean; finalContent: string } {
    const fullPath = path.join(input.projectDir, input.relPath);

    switch (input.choice) {
      case 'keep_user': {
        // Giữ nguyên bản của người dùng
        fs.writeFileSync(fullPath, input.userVersion, 'utf8');
        return { ok: true, finalContent: input.userVersion };
      }
      case 'use_ai': {
        // Dùng bản của AI
        fs.writeFileSync(fullPath, input.aiVersion, 'utf8');
        return { ok: true, finalContent: input.aiVersion };
      }
      case 'keep_user_ask_ai': {
        // Giữ bản người dùng và chuẩn bị yêu cầu AI hợp nhất
        fs.writeFileSync(fullPath, input.userVersion, 'utf8');
        return { ok: true, finalContent: input.userVersion };
      }
    }
  }
}
