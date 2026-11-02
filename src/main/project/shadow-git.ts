import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FileChangeType } from '../db/step-files-repo';

export interface ChangedFileEntry {
  readonly path: string;
  readonly change: FileChangeType;
  readonly linesAdded: number;
  readonly linesDeleted: number;
}

export interface ShadowGitConfig {
  readonly workTree: string;
  readonly shadowGitDir: string;
}

export class ShadowGitService {
  public readonly workTree: string;
  public readonly shadowGitDir: string;

  public constructor(config: ShadowGitConfig) {
    this.workTree = path.resolve(config.workTree);
    this.shadowGitDir = path.resolve(config.shadowGitDir);
  }

  private runGit(args: string[]): string {
    return execFileSync(
      'git',
      [`--git-dir=${this.shadowGitDir}`, `--work-tree=${this.workTree}`, ...args],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'CodeFleet Checkpoint',
          GIT_AUTHOR_EMAIL: 'checkpoint@codefleet.local',
          GIT_COMMITTER_NAME: 'CodeFleet Checkpoint',
          GIT_COMMITTER_EMAIL: 'checkpoint@codefleet.local',
        },
      },
    ).trim();
  }

  public init(): void {
    if (!fs.existsSync(this.shadowGitDir)) {
      fs.mkdirSync(this.shadowGitDir, { recursive: true });
    }

    const headFile = path.join(this.shadowGitDir, 'HEAD');
    if (!fs.existsSync(headFile)) {
      execFileSync('git', [`--git-dir=${this.shadowGitDir}`, 'init', '--bare'], {
        encoding: 'utf8',
      });
      execFileSync(
        'git',
        [`--git-dir=${this.shadowGitDir}`, 'config', 'core.bare', 'false'],
        { encoding: 'utf8' },
      );
      execFileSync(
        'git',
        [`--git-dir=${this.shadowGitDir}`, 'config', 'core.autocrlf', 'false'],
        { encoding: 'utf8' },
      );

      const excludePath = path.join(this.shadowGitDir, 'info', 'exclude');
      fs.mkdirSync(path.dirname(excludePath), { recursive: true });
      fs.writeFileSync(
        excludePath,
        [
          '# CodeFleet shadow git exclusions',
          '.git',
          '.git/',
          'node_modules/',
          'dist/',
          'out/',
          'build/',
          '.next/',
          '.nuxt/',
          '*.log',
        ].join('\n') + '\n',
        'utf8',
      );
    }
  }

  public createCheckpoint(description: string): string {
    this.init();
    this.runGit(['add', '-A']);
    try {
      this.runGit(['commit', '--allow-empty', '-m', description]);
    } catch {
      // Nếu commit không đổi và allow-empty được bật
    }
    return this.runGit(['rev-parse', 'HEAD']);
  }

  public getHeadHash(): string | null {
    try {
      return this.runGit(['rev-parse', 'HEAD']);
    } catch {
      return null;
    }
  }

  public getChangedFiles(fromHash: string, toHash: string): ChangedFileEntry[] {
    try {
      const output = this.runGit(['diff', '--name-status', fromHash, toHash]);
      if (!output) return [];

      const lines = output.split('\n').filter(Boolean);
      const result: ChangedFileEntry[] = [];

      for (const line of lines) {
        const parts = line.split(/\t+/);
        if (parts.length >= 2) {
          const statusChar = parts[0].trim().charAt(0).toUpperCase();
          const filePath = parts[1].trim();

          let change: FileChangeType = 'modified';
          if (statusChar === 'A') change = 'added';
          else if (statusChar === 'D') change = 'deleted';

          result.push({
            path: filePath,
            change,
            linesAdded: 0,
            linesDeleted: 0,
          });
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  public getDiffForFile(fromHash: string, toHash: string, filePath: string): string {
    try {
      return this.runGit(['diff', fromHash, toHash, '--', filePath]);
    } catch {
      return '';
    }
  }

  public getFullDiff(fromHash: string, toHash: string): string {
    try {
      return this.runGit(['diff', fromHash, toHash]);
    } catch {
      return '';
    }
  }

  public restoreCheckpoint(commitHash: string): void {
    // 1. Dọn các file không có trong commit đích
    const currentTracked = this.runGit(['ls-files', '-z']).split('\0').filter(Boolean);
    const targetTracked = new Set(
      this.runGit(['ls-tree', '-r', '--name-only', '-z', commitHash])
        .split('\0')
        .filter(Boolean),
    );
    const untracked = this.runGit(['ls-files', '--others', '--exclude-standard', '-z'])
      .split('\0')
      .filter(Boolean);

    for (const rel of [
      ...currentTracked.filter((f) => !targetTracked.has(f)),
      ...untracked,
    ]) {
      if (rel === '.git' || rel.startsWith('.git/') || rel.startsWith('.git\\')) continue;
      const full = path.resolve(this.workTree, rel);
      if (full.startsWith(this.workTree + path.sep) && fs.existsSync(full)) {
        try {
          fs.rmSync(full, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }

    // 2. Checkout index và khôi phục cây file
    this.runGit(['read-tree', commitHash]);
    this.runGit(['checkout-index', '-f', '-a']);
  }
}
