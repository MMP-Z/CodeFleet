import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertPathInsideProject, PathViolationError, writeProjectFileSafe } from './path-guard';

describe('path-guard (Luật B4: AI chỉ được ghi trong thư mục dự án)', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeWorkspace(): { outerDir: string; projectDir: string } {
    const outerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-b4-test-'));
    tempDirs.push(outerDir);
    const projectDir = path.join(outerDir, 'my-project');
    fs.mkdirSync(projectDir, { recursive: true });
    return { outerDir, projectDir };
  }

  it('allows relative and nested file writes inside projectRoot', () => {
    const { projectDir } = makeWorkspace();
    const writtenPath = writeProjectFileSafe(
      projectDir,
      'src/components/Header.tsx',
      'export const Header = () => null;\n',
    );

    expect(fs.existsSync(writtenPath)).toBe(true);
    expect(fs.readFileSync(writtenPath, 'utf8')).toContain('Header');
  });

  it('blocks parent traversal (../) and absolute paths outside projectRoot', () => {
    const { outerDir, projectDir } = makeWorkspace();
    const escapedFile = path.join(outerDir, 'escaped-secret.txt');

    expect(() => writeProjectFileSafe(projectDir, '../escaped-secret.txt', 'pwned')).toThrow(
      PathViolationError,
    );
    expect(fs.existsSync(escapedFile)).toBe(false);

    expect(() =>
      assertPathInsideProject(projectDir, path.join(outerDir, 'another-outside.txt')),
    ).toThrow(PathViolationError);

    expect(() => assertPathInsideProject(projectDir, 'sub/../../../outside.txt')).toThrow(
      PathViolationError,
    );
  });

  it('blocks symlink / junction escape attempts pointing outside projectRoot', () => {
    const { outerDir, projectDir } = makeWorkspace();
    const secretOutsideDir = path.join(outerDir, 'outside-vault');
    fs.mkdirSync(secretOutsideDir, { recursive: true });

    const linkInsideProject = path.join(projectDir, 'linked-vault');
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(secretOutsideDir, linkInsideProject, symlinkType);

    expect(() => writeProjectFileSafe(projectDir, 'linked-vault/stolen.txt', 'blocked')).toThrow(
      PathViolationError,
    );
    expect(fs.existsSync(path.join(secretOutsideDir, 'stolen.txt'))).toBe(false);
  });
});
