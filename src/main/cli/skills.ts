import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type SkillScope = 'project' | 'user';

export const SKILL_AGENTS = ['codex', 'claude', 'agy', 'copilot'] as const;
export type SkillAgent = (typeof SKILL_AGENTS)[number];

export interface SkillLocation {
  readonly scope: SkillScope;
  readonly dir: string;
  readonly agents: readonly SkillAgent[];
}

export interface SkillInfo {
  readonly name: string;
  readonly description: string;
  readonly dir: string;
  readonly location: SkillLocation;
}

export interface SkillGitSource {
  readonly repo: string;
  readonly ref?: string;
  readonly subpath?: string;
}

export interface SkillInstallOptions {
  readonly url: string;
  readonly scope: SkillScope;
  readonly agents: readonly SkillAgent[];
  readonly force?: boolean;
  readonly only?: string;
}

export interface SkillInstallResult {
  readonly name: string;
  readonly targets: readonly string[];
}

export type GitClone = (source: SkillGitSource, destination: string) => Promise<void>;

export interface SkillServiceOptions {
  readonly projectDir: string;
  readonly homeDir?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly clone?: GitClone;
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.venv', '__pycache__']);
const MAX_SEARCH_DEPTH = 5;

/** Đọc `name` và `description` trong YAML frontmatter của SKILL.md. */
export function parseSkillFrontmatter(text: string): { name?: string; description?: string } {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const result: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const field = /^(name|description):\s*(.*)$/.exec(lines[i]);
    if (!field) continue;
    let value = field[2].trim();
    if (/^[>|][-+]?$/.test(value) || value === '') {
      const block: string[] = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
        block.push(lines[++i].trim());
      }
      value = block.filter(Boolean).join(' ');
    } else if (/^(['"]).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    result[field[1]] = value;
  }
  return result;
}

/** Chuẩn hoá link git, hỗ trợ link thư mục GitHub/GitLab dạng `/tree/<nhánh>/<đường dẫn>`. */
export function parseGitSource(input: string): SkillGitSource {
  const url = input.trim();
  if (!url || url.startsWith('-')) throw new Error('Link git không hợp lệ.');
  if (/^git@[\w.-]+:[\w./~-]+$/.test(url) || /^ssh:\/\//.test(url)) return { repo: url };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Link git phải bắt đầu bằng https://, http://, ssh:// hoặc git@.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Link git phải bắt đầu bằng https://, http://, ssh:// hoặc git@.');
  }
  if (parsed.username || parsed.password) {
    throw new Error(
      'Không đưa thông tin đăng nhập vào link; dùng trình quản lý credential của git.',
    );
  }
  const segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const marker = segments.findIndex(
    (segment, index) => (segment === 'tree' || segment === 'blob') && index >= 2,
  );
  if (marker === -1) {
    parsed.hash = '';
    parsed.search = '';
    return { repo: parsed.toString().replace(/\/+$/, '') };
  }
  const repoSegments = segments.slice(0, segments[marker - 1] === '-' ? marker - 1 : marker);
  const ref = segments[marker + 1];
  let rest = segments.slice(marker + 2);
  if (rest.length && /^skill\.md$/i.test(rest[rest.length - 1])) rest = rest.slice(0, -1);
  if (rest.some((segment) => segment === '..' || segment === '.')) {
    throw new Error('Đường dẫn trong link git không hợp lệ.');
  }
  return {
    repo: `${parsed.protocol}//${parsed.host}/${repoSegments.join('/')}`,
    ref,
    subpath: rest.length ? rest.join('/') : undefined,
  };
}

export function sanitizeSkillName(name: string): string {
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (!clean) throw new Error(`Tên skill không hợp lệ: ${name}`);
  return clean.slice(0, 64);
}

export function resolveSkillAgents(value: string | undefined, current: string): SkillAgent[] {
  const target = value ?? current;
  if (target === 'all' || target === 'auto') return [...SKILL_AGENTS];
  if ((SKILL_AGENTS as readonly string[]).includes(target)) return [target as SkillAgent];
  throw new Error(`Agent ${target} chưa hỗ trợ skill. Chọn: ${SKILL_AGENTS.join(', ')}, all.`);
}

const defaultClone: GitClone = (source, destination) =>
  new Promise((resolve, reject) => {
    const args = ['clone', '--depth', '1', '--quiet'];
    if (source.ref) args.push('--branch', source.ref);
    args.push('--', source.repo, destination);
    execFile(
      'git',
      args,
      {
        timeout: 120000,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
      (error, _stdout, stderr) => {
        if (!error) return resolve();
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') reject(new Error('Không tìm thấy git. Cài git rồi thử lại.'));
        else reject(new Error(`git clone thất bại: ${String(stderr).trim() || error.message}`));
      },
    );
  });

export class SkillService {
  private readonly projectDir: string;
  private readonly homeDir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly clone: GitClone;

  public constructor(options: SkillServiceOptions) {
    this.projectDir = options.projectDir;
    this.homeDir = options.homeDir ?? os.homedir();
    this.env = options.env ?? process.env;
    this.clone = options.clone ?? defaultClone;
  }

  /** Các thư mục mà từng AI CLI đọc skill. */
  public locations(): SkillLocation[] {
    const project = (rel: string): string => path.join(this.projectDir, rel);
    const home = (rel: string): string => path.join(this.homeDir, rel);
    const codexHome = this.env.CODEX_HOME ? path.resolve(this.env.CODEX_HOME) : home('.codex');
    return [
      { scope: 'project', dir: project('.agents/skills'), agents: ['codex', 'agy', 'copilot'] },
      { scope: 'project', dir: project('.claude/skills'), agents: ['claude', 'copilot'] },
      { scope: 'project', dir: project('.github/skills'), agents: ['copilot'] },
      { scope: 'user', dir: home('.agents/skills'), agents: ['codex', 'copilot'] },
      { scope: 'user', dir: path.join(codexHome, 'skills'), agents: ['codex'] },
      { scope: 'user', dir: home('.claude/skills'), agents: ['claude'] },
      { scope: 'user', dir: home('.copilot/skills'), agents: ['copilot'] },
      { scope: 'user', dir: home('.gemini/config/skills'), agents: ['agy'] },
    ];
  }

  /** Thư mục cài đặt cho mỗi agent theo phạm vi. */
  public installDir(agent: SkillAgent, scope: SkillScope): string {
    const project = scope === 'project';
    const base = project ? this.projectDir : this.homeDir;
    switch (agent) {
      case 'codex':
        return path.join(base, '.agents/skills');
      case 'claude':
        return path.join(base, '.claude/skills');
      case 'agy':
        return project
          ? path.join(base, '.agents/skills')
          : path.join(base, '.gemini/config/skills');
      case 'copilot':
        return project ? path.join(base, '.agents/skills') : path.join(base, '.copilot/skills');
    }
  }

  public list(): SkillInfo[] {
    const result: SkillInfo[] = [];
    const seen = new Set<string>();
    for (const location of this.locations()) {
      const key = path.resolve(location.dir).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(location.dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const dir = path.join(location.dir, entry.name);
        const file = path.join(dir, 'SKILL.md');
        let text: string;
        try {
          text = fs.readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        const meta = parseSkillFrontmatter(text);
        result.push({
          name: meta.name || entry.name,
          description: meta.description ?? '',
          dir,
          location,
        });
      }
    }
    return result;
  }

  public async install(options: SkillInstallOptions): Promise<SkillInstallResult[]> {
    if (!options.agents.length) throw new Error('Chưa chọn agent để cài skill.');
    const source = parseGitSource(options.url);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-skill-'));
    try {
      const checkout = path.join(temp, 'repo');
      await this.clone(source, checkout);
      const root = source.subpath ? path.resolve(checkout, source.subpath) : checkout;
      if (!isInside(checkout, root) || !fs.existsSync(root)) {
        throw new Error(`Không tìm thấy thư mục ${source.subpath} trong repo.`);
      }
      let found = findSkillDirs(root).map((dir) => {
        const meta = parseSkillFrontmatter(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'));
        const fallback = dir === checkout ? repoName(source.repo) : path.basename(dir);
        return { dir, name: sanitizeSkillName(meta.name || fallback) };
      });
      if (!found.length) throw new Error('Repo không có file SKILL.md nào.');
      if (options.only) {
        const wanted = sanitizeSkillName(options.only);
        found = found.filter((skill) => skill.name === wanted);
        if (!found.length) throw new Error(`Không tìm thấy skill ${options.only} trong repo.`);
      }
      const names = new Set<string>();
      for (const skill of found) {
        if (names.has(skill.name)) throw new Error(`Repo có nhiều skill trùng tên ${skill.name}.`);
        names.add(skill.name);
      }
      const dirs = [
        ...new Set(options.agents.map((agent) => this.installDir(agent, options.scope))),
      ];
      const plan = found.map((skill) => ({
        ...skill,
        targets: dirs.map((dir) => path.join(dir, skill.name)),
      }));
      if (!options.force) {
        const existing = plan.flatMap((skill) => skill.targets).filter((t) => fs.existsSync(t));
        if (existing.length) {
          throw new Error(`Skill đã tồn tại: ${existing.join(', ')}. Thêm --force để ghi đè.`);
        }
      }
      for (const skill of plan) {
        for (const target of skill.targets) {
          fs.rmSync(target, { recursive: true, force: true });
          copySkillDir(skill.dir, target);
        }
      }
      return plan.map(({ name, targets }) => ({ name, targets }));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
  }

  /** Gỡ skill khỏi các thư mục cài đặt của agent đã chọn. */
  public remove(name: string, scope: SkillScope, agents: readonly SkillAgent[]): string[] {
    const clean = sanitizeSkillName(name);
    const removed: string[] = [];
    for (const dir of new Set(agents.map((agent) => this.installDir(agent, scope)))) {
      const target = path.join(dir, clean);
      if (!fs.existsSync(path.join(target, 'SKILL.md'))) continue;
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    }
    if (!removed.length) throw new Error(`Không tìm thấy skill ${clean} để gỡ.`);
    return removed;
  }
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function repoName(repo: string): string {
  return (
    repo
      .replace(/\.git$/, '')
      .split(/[/:]/)
      .filter(Boolean)
      .pop() ?? 'skill'
  );
}

function findSkillDirs(root: string, depth = 0): string[] {
  if (fs.existsSync(path.join(root, 'SKILL.md'))) return [root];
  if (depth >= MAX_SEARCH_DEPTH) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
    result.push(...findSkillDirs(path.join(root, entry.name), depth + 1));
  }
  return result;
}

/** Sao chép thư mục skill, bỏ qua `.git` và symlink để không trỏ ra ngoài repo. */
function copySkillDir(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.isSymbolicLink()) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copySkillDir(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
