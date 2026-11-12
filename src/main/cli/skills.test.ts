import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeCommand } from './completion';
import { formatSkillList, runSkillCommand, splitArgs } from './skill-command';
import {
  SkillService,
  parseGitSource,
  parseSkillFrontmatter,
  resolveSkillAgents,
  type GitClone,
} from './skills';

const cleanup: string[] = [];
afterEach(() => {
  for (const dir of cleanup.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-skills-'));
  cleanup.push(dir);
  return dir;
}

function writeSkill(dir: string, name: string, description = 'Mô tả'): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`,
  );
}

function fixture(repo: (dir: string) => void) {
  const root = tempDir();
  const projectDir = path.join(root, 'project');
  const homeDir = path.join(root, 'home');
  fs.mkdirSync(projectDir);
  fs.mkdirSync(homeDir);
  const clone = vi.fn<GitClone>(async (_source, destination) => {
    fs.mkdirSync(destination, { recursive: true });
    repo(destination);
  });
  const service = new SkillService({ projectDir, homeDir, env: {}, clone });
  return { service, clone, projectDir, homeDir };
}

describe('skill parsing', () => {
  it('reads plain, quoted and folded frontmatter values', () => {
    expect(parseSkillFrontmatter('---\nname: "pdf"\ndescription: >-\n  Đọc\n  PDF\n---\n')).toEqual(
      {
        name: 'pdf',
        description: 'Đọc PDF',
      },
    );
    expect(parseSkillFrontmatter('# không có frontmatter')).toEqual({});
  });

  it('normalises git links including GitHub and GitLab folder links', () => {
    expect(parseGitSource('https://github.com/o/r.git')).toEqual({
      repo: 'https://github.com/o/r.git',
    });
    expect(parseGitSource('https://github.com/o/r/tree/main/skills/pdf')).toEqual({
      repo: 'https://github.com/o/r',
      ref: 'main',
      subpath: 'skills/pdf',
    });
    expect(parseGitSource('https://gitlab.com/g/r/-/blob/dev/a/SKILL.md')).toEqual({
      repo: 'https://gitlab.com/g/r',
      ref: 'dev',
      subpath: 'a',
    });
    expect(parseGitSource('git@github.com:o/r.git')).toEqual({ repo: 'git@github.com:o/r.git' });
    expect(() => parseGitSource('--upload-pack=evil')).toThrow();
    expect(() => parseGitSource('file:///etc')).toThrow();
    expect(() => parseGitSource('https://user:token@github.com/o/r')).toThrow();
  });

  it('resolves agents and splits quoted arguments', () => {
    expect(resolveSkillAgents(undefined, 'codex')).toEqual(['codex']);
    expect(resolveSkillAgents(undefined, 'auto')).toHaveLength(4);
    expect(() => resolveSkillAgents('gemini', 'codex')).toThrow();
    expect(splitArgs('install "D:\\a b" --force')).toEqual(['install', 'D:\\a b', '--force']);
  });
});

describe('SkillService', () => {
  it('installs every skill in a repo for the selected agents and lists them', async () => {
    const { service, clone, homeDir, projectDir } = fixture((dir) => {
      writeSkill(path.join(dir, 'skills', 'pdf'), 'PDF Tools');
      writeSkill(path.join(dir, 'skills', 'docx'), 'docx');
      fs.mkdirSync(path.join(dir, '.git'));
    });
    const result = await service.install({
      url: 'https://github.com/o/r',
      scope: 'user',
      agents: ['claude', 'agy'],
    });
    expect(clone).toHaveBeenCalledTimes(1);
    expect(result.map((skill) => skill.name).sort()).toEqual(['docx', 'pdf-tools']);
    expect(fs.existsSync(path.join(homeDir, '.claude/skills/pdf-tools/SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(homeDir, '.gemini/config/skills/docx/SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, '.agents'))).toBe(false);
    const listed = service.list();
    expect(listed).toHaveLength(4);
    expect(formatSkillList(listed, 'claude')).toContain('PDF Tools');

    await expect(
      service.install({ url: 'https://github.com/o/r', scope: 'user', agents: ['claude'] }),
    ).rejects.toThrow('--force');
    await service.install({
      url: 'https://github.com/o/r',
      scope: 'user',
      agents: ['claude'],
      force: true,
      only: 'docx',
    });
    expect(service.remove('docx', 'user', ['claude'])).toHaveLength(1);
    expect(() => service.remove('docx', 'user', ['claude'])).toThrow();
  });

  it('installs a root skill into the shared project folder and uses the folder link', async () => {
    const { service, clone, projectDir } = fixture((dir) =>
      writeSkill(path.join(dir, 'a'), 'alpha'),
    );
    const result = await service.install({
      url: 'https://github.com/o/r/tree/main/a',
      scope: 'project',
      agents: ['codex', 'agy', 'copilot'],
    });
    expect(clone.mock.calls[0][0]).toMatchObject({ ref: 'main', subpath: 'a' });
    expect(result).toEqual([
      { name: 'alpha', targets: [path.join(projectDir, '.agents/skills/alpha')] },
    ]);
  });

  it('rejects repos without SKILL.md', async () => {
    const { service } = fixture((dir) => fs.writeFileSync(path.join(dir, 'README.md'), 'x'));
    await expect(
      service.install({ url: 'https://github.com/o/r', scope: 'user', agents: ['codex'] }),
    ).rejects.toThrow('SKILL.md');
  });
});

describe('/skill command', () => {
  it('lists, installs and reports changes through the context', async () => {
    const { service, homeDir } = fixture((dir) => writeSkill(dir, 'root-skill'));
    const output: string[] = [];
    const onChanged = vi.fn();
    const ctx = {
      service,
      currentAgent: 'codex',
      line: (text: string) => output.push(text),
      notice: vi.fn(),
      onChanged,
    };
    await runSkillCommand('', ctx);
    expect(output.join('\n')).toContain('Chưa có skill');
    await runSkillCommand(' install https://github.com/o/r', ctx);
    expect(fs.existsSync(path.join(homeDir, '.agents/skills/root-skill/SKILL.md'))).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
    await expect(runSkillCommand(' install', ctx)).rejects.toThrow('/skill install');
    await expect(runSkillCommand(' bogus', ctx)).rejects.toThrow('/skill help');
    expect(completeCommand('/sk', [])).toEqual([['/skill'], '/sk']);
    expect(completeCommand('/skill in', [])).toEqual([['/skill install '], '/skill in']);
  });
});
