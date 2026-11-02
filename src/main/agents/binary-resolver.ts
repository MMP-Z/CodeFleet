import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentId } from './types';

/**
 * Trả về danh sách các đường dẫn ứng viên có thể chứa file thực thi của từng AI CLI.
 * Hỗ trợ các trình cài đặt chính thức (Desktop app, native script, global npm, user local bin).
 */
export function getAgentBinaryCandidates(agentId: AgentId): string[] {
  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  const exeSuffix = isWin ? '.exe' : '';
  const cmdSuffix = isWin ? '.cmd' : '';

  switch (agentId) {
    case 'codex':
      return [
        // 1. OpenAI Codex Desktop / sandbox-bin (Windows/macOS standard location)
        path.join(home, '.codex', '.sandbox-bin', `codex${exeSuffix}`),
        path.join(home, '.codex', 'bin', `codex${exeSuffix}`),
        // 2. Local Programs directory
        path.join(localAppData, 'Programs', 'Codex', `codex${exeSuffix}`),
        // 3. npm global install
        path.join(appData, 'npm', `codex${cmdSuffix}`),
        // 4. User local bin (macOS/Linux or winget/scoop)
        path.join(home, '.local', 'bin', `codex${exeSuffix}`),
        // 5. Bare command on system PATH
        'codex',
      ];

    case 'claude':
      return [
        // 1. Anthropic native installer (~/.local/bin/claude.exe)
        path.join(home, '.local', 'bin', `claude${exeSuffix}`),
        // 2. Local Programs directory
        path.join(localAppData, 'Programs', 'Claude', `claude${exeSuffix}`),
        path.join(home, '.claude', 'bin', `claude${exeSuffix}`),
        // 3. npm global install
        path.join(appData, 'npm', `claude${cmdSuffix}`),
        path.join(localAppData, 'AnthropicClaude', `claude${exeSuffix}`),
        // 4. Bare command on system PATH
        'claude',
      ];

    case 'gemini':
      return [
        // 1. npm global install
        path.join(appData, 'npm', `gemini${cmdSuffix}`),
        // 2. Gemini user bin
        path.join(home, '.gemini', 'bin', `gemini${exeSuffix}`),
        path.join(home, '.local', 'bin', `gemini${exeSuffix}`),
        path.join(localAppData, 'Programs', 'Gemini', `gemini${exeSuffix}`),
        // 3. Bare command on system PATH
        'gemini',
      ];

    default:
      return [agentId];
  }
}

/**
 * Tìm file thực thi khả dụng nhất của một AI CLI:
 * Kiểm tra các thư mục cài đặt tiêu chuẩn trước; nếu không thấy thì trả về tên lệnh mặc định trên PATH.
 */
export function resolveAgentBinary(agentId: AgentId): string {
  const candidates = getAgentBinaryCandidates(agentId);
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes('/')) {
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // Bỏ qua lỗi truy cập file hệ thống
      }
    }
  }
  return agentId;
}

/**
 * Xác định cấu hình thực thi lệnh an toàn:
 * - Trên Windows: File .cmd / .bat bắt buộc dùng shell: true.
 * - File .exe hoặc đường dẫn tuyệt đối chứa khoảng trắng (như "C:\Users\HOANG VIET\..."):
 *   dùng shell: false để tránh cmd.exe phân tích sai khoảng trắng.
 * - Lệnh đơn trên PATH: dùng shell: true để Windows tìm trên PATH qua cmd.exe.
 */
export function getCommandExecutionOptions(binary: string): { shell: boolean } {
  if (process.platform !== 'win32') {
    return { shell: false };
  }
  if (/\.(cmd|bat)$/i.test(binary)) {
    return { shell: true };
  }
  if (binary.includes('\\') || binary.includes('/')) {
    return { shell: false };
  }
  return { shell: true };
}
