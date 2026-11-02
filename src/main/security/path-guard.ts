import fs from 'node:fs';
import path from 'node:path';

export class PathViolationError extends Error {
  public readonly projectRoot: string;
  public readonly attemptedPath: string;

  public constructor(projectRoot: string, attemptedPath: string, detail: string) {
    super(`Vi phạm Luật B4: Chặn truy cập ngoài thư mục dự án (${attemptedPath}) — ${detail}`);
    this.name = 'PathViolationError';
    this.projectRoot = projectRoot;
    this.attemptedPath = attemptedPath;
  }
}

/**
 * Tìm đường dẫn thực tế (realpath) của tổ tiên gần nhất đã tồn tại trên đĩa,
 * rồi nối phần đường dẫn con chưa tồn tại vào để phát hiện symlink thoát ra ngoài (Luật B4).
 */
function resolveRealWithNonExistentTail(targetPath: string): string {
  const absoluteTarget = path.resolve(targetPath);
  const tailSegments: string[] = [];
  let cursor = absoluteTarget;

  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    tailSegments.unshift(path.basename(cursor));
    cursor = parent;
  }

  const realExisting = fs.existsSync(cursor) ? fs.realpathSync(cursor) : cursor;
  return tailSegments.length > 0 ? path.join(realExisting, ...tailSegments) : realExisting;
}

function isSubPath(realRoot: string, realTarget: string): boolean {
  const normalizedRoot = process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;
  const normalizedTarget = process.platform === 'win32' ? realTarget.toLowerCase() : realTarget;

  const rel = path.relative(normalizedRoot, normalizedTarget);
  if (rel === '') {
    return true;
  }
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Kiểm tra và trả về đường dẫn tuyệt đối an toàn bên trong thư mục dự án (Luật B4).
 * Chặn mọi hành vi dùng '..', đường dẫn tuyệt đối ngoài dự án, hoặc symlink trỏ ra ngoài.
 */
export function assertPathInsideProject(projectRoot: string, candidatePath: string): string {
  if (!candidatePath || candidatePath.trim() === '' || candidatePath.includes('\0')) {
    throw new PathViolationError(projectRoot, candidatePath, 'Đường dẫn rỗng hoặc chứa ký tự null');
  }

  const realRoot = resolveRealWithNonExistentTail(projectRoot);
  const resolvedCandidate = path.resolve(realRoot, candidatePath);
  const realCandidate = resolveRealWithNonExistentTail(resolvedCandidate);

  if (!isSubPath(realRoot, realCandidate)) {
    throw new PathViolationError(
      realRoot,
      candidatePath,
      'Đường dẫn vượt ra ngoài phạm vi thư mục dự án',
    );
  }

  // Nếu bản thân file đích đã tồn tại và là symlink, kiểm tra đích thực của nó
  if (fs.existsSync(resolvedCandidate)) {
    const realExistingTarget = fs.realpathSync(resolvedCandidate);
    if (!isSubPath(realRoot, realExistingTarget)) {
      throw new PathViolationError(realRoot, candidatePath, 'Symlink trỏ ra ngoài thư mục dự án');
    }
  }

  return realCandidate;
}

export class PathGuard {
  private readonly projectRoot: string;

  public constructor(options: { readonly projectRoot: string }) {
    this.projectRoot = options.projectRoot;
  }

  public isWithinProject(candidatePath: string): boolean {
    try {
      assertPathInsideProject(this.projectRoot, candidatePath);
      return true;
    } catch {
      return false;
    }
  }

  public assertInside(candidatePath: string): string {
    return assertPathInsideProject(this.projectRoot, candidatePath);
  }
}

/**
 * Ghi file văn bản an toàn vào dự án sau khi kiểm tra Luật B4.
 */
export function writeProjectFileSafe(
  projectRoot: string,
  relativeOrAbsolutePath: string,
  content: string,
): string {
  const safeTarget = assertPathInsideProject(projectRoot, relativeOrAbsolutePath);
  fs.mkdirSync(path.dirname(safeTarget), { recursive: true });
  fs.writeFileSync(safeTarget, content, 'utf8');
  return safeTarget;
}
