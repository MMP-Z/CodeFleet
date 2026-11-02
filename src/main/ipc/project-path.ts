import fs from 'node:fs';
import path from 'node:path';
import type { ProjectPathValidation } from '@shared/ipc';

export function validateProjectPath(targetPath: string): ProjectPathValidation {
  if (!targetPath || targetPath.trim() === '' || targetPath.includes('\0')) {
    return {
      exists: false,
      isEmpty: false,
      isWritable: false,
      hasUserGit: false,
      errorDetail: 'Đường dẫn không hợp lệ hoặc chứa ký tự đặc biệt',
    };
  }

  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    // Thư mục chưa tồn tại, kiểm tra xem thư mục cha có quyền tạo không
    let parent = path.dirname(resolved);
    while (!fs.existsSync(parent) && parent !== path.dirname(parent)) {
      parent = path.dirname(parent);
    }

    let isParentWritable = false;
    try {
      const testFile = path.join(parent, `.cf-perm-test-${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      isParentWritable = true;
    } catch {
      isParentWritable = false;
    }

    return {
      exists: false,
      isEmpty: true,
      isWritable: isParentWritable,
      hasUserGit: false,
      errorDetail: isParentWritable ? null : 'Thư mục cha không có quyền ghi để tạo dự án mới',
    };
  }

  // Thư mục đã tồn tại
  let isDirectory = false;
  try {
    const stat = fs.statSync(resolved);
    isDirectory = stat.isDirectory();
  } catch {
    return {
      exists: true,
      isEmpty: false,
      isWritable: false,
      hasUserGit: false,
      errorDetail: 'Không thể đọc thông tin thư mục này',
    };
  }

  if (!isDirectory) {
    return {
      exists: true,
      isEmpty: false,
      isWritable: false,
      hasUserGit: false,
      errorDetail: 'Đường dẫn đã chọn là một file, không phải thư mục',
    };
  }

  // Kiểm tra thư mục có trống không
  let isEmpty = true;
  let hasUserGit = false;
  try {
    const entries = fs.readdirSync(resolved);
    const ignored = new Set(['.git', '.DS_Store', 'Thumbs.db', 'desktop.ini']);
    const meaningfulEntries = entries.filter((e) => !ignored.has(e));
    isEmpty = meaningfulEntries.length === 0;
    hasUserGit = fs.existsSync(path.join(resolved, '.git'));
  } catch {
    isEmpty = false;
  }

  // Kiểm tra quyền ghi
  let isWritable = false;
  try {
    const testFile = path.join(resolved, `.cf-perm-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    isWritable = true;
  } catch {
    isWritable = false;
  }

  return {
    exists: true,
    isEmpty,
    isWritable,
    hasUserGit,
    errorDetail: isWritable
      ? null
      : 'Thư mục này không có quyền ghi. Vui lòng chọn một thư mục khác trong Documents.',
  };
}
