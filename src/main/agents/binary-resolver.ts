import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentId } from './types';

let codexDesktopBinary: string | undefined;

function findCodexDesktop(): string | undefined {
  if (codexDesktopBinary && fs.existsSync(codexDesktopBinary)) return codexDesktopBinary;
  try {
    const installLocation = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1 -ExpandProperty InstallLocation',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (!path.isAbsolute(installLocation)) return;
    const binary = path.join(installLocation, 'app', 'resources', 'codex.exe');
    if (fs.existsSync(binary)) {
      codexDesktopBinary = binary;
      return binary;
    }
  } catch {
    // The standalone Codex installation is also supported.
  }
  return undefined;
}

function getCodexPathCandidates(): string[] {
  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter(
      (entry) =>
        path.isAbsolute(entry) &&
        !path
          .normalize(entry)
          .split(path.sep)
          .some((segment) => segment.toLowerCase() === '.sandbox-bin'),
    )
    .flatMap((entry) =>
      process.platform === 'win32'
        ? [path.join(entry, 'codex.exe'), path.join(entry, 'codex.cmd')]
        : [path.join(entry, 'codex')],
    );
}

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
        // Keep Codex beside the helper binaries supplied by its installation.
        ...getCodexPathCandidates(),
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

    case 'copilot': {
      const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
      return [
        // 1. GitHub Copilot CLI official MSI installer location (winget install GitHub.Copilot)
        path.join(localAppData, 'GitHubCopilotCLI', `copilot${exeSuffix}`),
        path.join(progFiles, 'GitHub Copilot', `copilot${exeSuffix}`),
        path.join(progFiles, 'GitHub Copilot CLI', `copilot${exeSuffix}`),
        path.join(localAppData, 'Programs', 'GitHub Copilot', `copilot${exeSuffix}`),
        path.join(localAppData, 'Programs', 'GitHub Copilot CLI', `copilot${exeSuffix}`),
        path.join(localAppData, 'Programs', 'Copilot', `copilot${exeSuffix}`),
        // 2. npm global install
        path.join(appData, 'npm', `copilot${cmdSuffix}`),
        // 3. GitHub CLI standard install location (winget install GitHub.cli / gh copilot)
        path.join(progFiles, 'GitHub CLI', `gh${exeSuffix}`),
        path.join(localAppData, 'Programs', 'GitHub CLI', `gh${exeSuffix}`),
        path.join(home, '.local', 'bin', `copilot${exeSuffix}`),
        path.join(home, '.local', 'bin', `gh${exeSuffix}`),
        // 4. Bare command on system PATH
        'copilot',
        'gh',
      ];
    }

    case 'agy':
      return [
        // 1. Antigravity CLI PowerShell installer standard directory
        path.join(localAppData, 'agy', 'bin', `agy${exeSuffix}`),
        // 2. Gemini/Antigravity user directory
        path.join(home, '.gemini', 'bin', `agy${exeSuffix}`),
        path.join(home, '.gemini', 'antigravity', 'bin', `agy${exeSuffix}`),
        path.join(localAppData, 'Programs', 'Antigravity', 'bin', `agy${exeSuffix}`),
        path.join(appData, 'Antigravity', 'bin', `agy${exeSuffix}`),
        // 3. User local bin (macOS/Linux or winget/scoop)
        path.join(home, '.local', 'bin', `agy${exeSuffix}`),
        // 4. Bare command on system PATH
        'agy',
      ];

    default:
      return [agentId];
  }
}

export function isGitHubCli(binary: string): boolean {
  return /^gh(?:\.exe|\.cmd)?$/i.test(path.basename(binary));
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
  if (agentId === 'codex' && process.platform === 'win32') {
    return findCodexDesktop() ?? agentId;
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
