/* eslint-disable no-control-regex -- Terminal output must strip ANSI and control characters. */
import type { CodexSandboxMode } from '../agents/types';
import { parseInputMode, type InputMode } from './vietnamese-input';

export interface CliOptions {
  project: string;
  agent: string;
  model?: string;
  prompt?: string;
  resume?: string;
  dataDir?: string;
  help: boolean;
  agents: boolean;
  models?: boolean;
  mode?: 'agent' | 'subagent';
  ime?: boolean;
  inputMode?: InputMode;
  codexSandbox?: CodexSandboxMode;
}

export function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    project: process.cwd(),
    agent: 'codex',
    help: false,
    agents: false,
    inputMode: 'telex',
  };
  const values = new Map([
    ['--project', 'project'],
    ['--agent', 'agent'],
    ['--model', 'model'],
    ['--print', 'prompt'],
    ['-p', 'prompt'],
    ['--resume', 'resume'],
    ['--data-dir', 'dataDir'],
  ] as const);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--agents') options.agents = true;
    else if (arg === '--models') options.models = true;
    else if (arg === '--ime') options.ime = true;
    else if (arg === '--input') options.inputMode = parseInputMode(args[++i]);
    else if (arg === '--codex-sandbox') {
      const mode = args[++i];
      if (mode !== 'read-only' && mode !== 'workspace-write' && mode !== 'danger-full-access') {
        throw new Error('--codex-sandbox cần read-only, workspace-write hoặc danger-full-access.');
      }
      options.codexSandbox = mode;
    } else if (arg === '--mode') options.mode = parseMode(args[++i]);
    else {
      const key = values.get(arg as '--project');
      if (!key) throw new Error(`Tham số không hợp lệ: ${arg}. Dùng --help.`);
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Thiếu giá trị cho ${arg}`);
      options[key] = value;
    }
  }
  return options;
}

export function parseMode(value: string | undefined): NonNullable<CliOptions['mode']> {
  if (value === 'agent' || value === 'subagent') return value;
  throw new Error('Chọn chế độ agent hoặc subagent.');
}

// Strip terminal control sequences from agent output and stored/user-controlled labels.
export function terminalText(value: string): string {
  return value
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}
