import { execFile } from 'node:child_process';
import type { GitCheckOutput } from '@shared/ipc';

/**
 * Kiểm tra git hệ thống không dùng shell (an toàn, không ném lỗi khi thiếu git).
 */
export function checkSystemGit(binaryName = 'git'): Promise<GitCheckOutput> {
  return new Promise((resolve) => {
    execFile(binaryName, ['--version'], { timeout: 4000, windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve({ available: false, version: null });
        return;
      }
      const trimmed = stdout.trim();
      const match = /git version\s+([^\s]+)/i.exec(trimmed);
      resolve({
        available: true,
        version: match ? match[1] : trimmed || null,
      });
    });
  });
}

