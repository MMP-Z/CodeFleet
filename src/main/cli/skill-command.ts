import {
  SKILL_AGENTS,
  resolveSkillAgents,
  type SkillInfo,
  type SkillScope,
  type SkillService,
} from './skills';

export const SKILL_HELP = [
  'Lệnh skill:',
  '  /skill                              Xem skill đã cài (dự án và người dùng)',
  '  /skill install <link-git> [tùy chọn] Cài skill từ repo git',
  '  /skill remove <tên> [tùy chọn]      Gỡ skill',
  'Tùy chọn:',
  '  --project            Cài vào thư mục dự án (mặc định: thư mục người dùng)',
  `  --agent <id|all>     Agent nhận skill (${SKILL_AGENTS.join(', ')}, all; mặc định agent đang chọn)`,
  '  --skill <tên>        Chỉ cài một skill khi repo có nhiều skill',
  '  --force              Ghi đè skill trùng tên',
  'Hỗ trợ link thư mục, ví dụ https://github.com/owner/repo/tree/main/skills/pdf',
].join('\n');

export interface SkillCommandContext {
  readonly service: SkillService;
  readonly currentAgent: string;
  line(text: string): void;
  notice(text: string): void;
  /** Gọi sau khi skill thay đổi để phiên agent mới nạp lại skill. */
  onChanged(): void;
}

interface ParsedArgs {
  readonly positional: string[];
  readonly scope: SkillScope;
  readonly agent?: string;
  readonly skill?: string;
  readonly force: boolean;
}

export function splitArgs(input: string): string[] {
  const result: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input))) result.push(match[1] ?? match[2] ?? match[3]);
  return result;
}

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  let scope: SkillScope = 'user';
  let agent: string | undefined;
  let skill: string | undefined;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = (): string => {
      const next = args[++i];
      if (!next || next.startsWith('--')) throw new Error(`Thiếu giá trị cho ${arg}.`);
      return next;
    };
    if (arg === '--project') scope = 'project';
    else if (arg === '--global' || arg === '--user') scope = 'user';
    else if (arg === '--force' || arg === '-f') force = true;
    else if (arg === '--agent') agent = value();
    else if (arg === '--skill') skill = value();
    else if (arg.startsWith('--'))
      throw new Error(`Tùy chọn không hợp lệ: ${arg}. Gõ /skill help.`);
    else positional.push(arg);
  }
  return { positional, scope, agent, skill, force };
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatSkillList(skills: readonly SkillInfo[], currentAgent: string): string {
  if (!skills.length) {
    return 'Chưa có skill nào. Cài bằng /skill install <link-git>.';
  }
  const lines: string[] = [];
  let lastDir = '';
  const width = Math.min(28, Math.max(...skills.map((skill) => skill.name.length)));
  for (const skill of skills) {
    if (skill.location.dir !== lastDir) {
      lastDir = skill.location.dir;
      const scope = skill.location.scope === 'project' ? 'Dự án' : 'Người dùng';
      lines.push(
        `${lines.length ? '\n' : ''}${scope} · ${lastDir} (${skill.location.agents.join(', ')})`,
      );
    }
    const active =
      currentAgent === 'auto' ||
      (skill.location.agents as readonly string[]).includes(currentAgent);
    const description = shorten(skill.description.replace(/\s+/g, ' '), 90);
    lines.push(`  ${active ? '•' : ' '} ${skill.name.padEnd(width)}  ${description}`.trimEnd());
  }
  lines.push(`\n• skill agent ${currentAgent} đọc được. Tổng: ${skills.length}.`);
  return lines.join('\n');
}

export async function runSkillCommand(input: string, ctx: SkillCommandContext): Promise<void> {
  const [sub = 'list', ...rest] = splitArgs(input);
  if (sub === 'help') {
    ctx.line(SKILL_HELP);
    return;
  }
  if (sub === 'list' || sub === 'ls') {
    ctx.line(formatSkillList(ctx.service.list(), ctx.currentAgent));
    return;
  }
  const args = parseArgs(rest);
  const agents = resolveSkillAgents(args.agent, ctx.currentAgent);
  const where = args.scope === 'project' ? 'dự án' : 'người dùng';
  if (sub === 'install' || sub === 'add') {
    const url = args.positional[0];
    if (!url || args.positional.length > 1) {
      throw new Error('Dùng: /skill install <link-git> [--project] [--agent <id|all>] [--force]');
    }
    ctx.notice(`Đang tải skill từ ${url}…`);
    const installed = await ctx.service.install({
      url,
      scope: args.scope,
      agents,
      force: args.force,
      only: args.skill,
    });
    for (const skill of installed) {
      ctx.line(`Đã cài ${skill.name} (${where}, ${agents.join(', ')})`);
      for (const target of skill.targets) ctx.line(`  ${target}`);
    }
    ctx.line('Chỉ cài skill từ nguồn tin cậy: skill có thể chứa lệnh và script mà agent sẽ chạy.');
    ctx.onChanged();
    return;
  }
  if (sub === 'remove' || sub === 'rm' || sub === 'uninstall') {
    const name = args.positional[0];
    if (!name || args.positional.length > 1) {
      throw new Error('Dùng: /skill remove <tên> [--project] [--agent <id|all>]');
    }
    for (const target of ctx.service.remove(name, args.scope, agents)) {
      ctx.line(`Đã gỡ ${target}`);
    }
    ctx.onChanged();
    return;
  }
  throw new Error(`Lệnh skill không hợp lệ: ${sub}. Gõ /skill help.`);
}
