import { terminalText } from './options';

export interface TerminalViewConfig {
  write(text: string): void;
  writeHeader?(text: string): void;
  columns(): number;
  color: boolean;
  unicode: boolean;
  completion?: boolean;
  animateProgress?: boolean;
}

export interface TerminalWelcomeInfo {
  project: string;
  agent: string;
  model?: string;
}

export type TerminalTurnOutcome = 'done' | 'stopped' | 'error';

export interface TerminalView {
  welcome(info: TerminalWelcomeInfo): void;
  prompt(): string;
  footer(agent: string, model?: string, quota?: string): void;
  beginTurn(): void;
  stopProgress(): void;
  resumeProgress(): void;
  status(text: string): void;
  message(text: string): void;
  endTurn(elapsedMs: number, outcome: TerminalTurnOutcome): void;
  permission(title: string): void;
  error(text: string): void;
  notice(text: string): void;
}

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  terracotta: '\x1b[38;5;173m',
  terracottaBright: '\x1b[1;38;5;209m',
  amber: '\x1b[38;5;215m',
  muted: '\x1b[38;5;245m',
  sage: '\x1b[38;5;108m',
  coral: '\x1b[1;38;5;203m',
} as const;

function sanitize(value: string): string {
  return terminalText(value).replace(/\r\n/g, '\n').replace(/\r/g, '');
}

function sanitizeInline(value: string): string {
  return sanitize(value)
    .replace(/[\n\t]+/g, ' ')
    .trim();
}

function formatDuration(elapsedMs: number): string {
  const safeMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (safeMs < 1000) {
    return `${Math.round(safeMs)}ms`;
  }
  const seconds = safeMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  return `${mins}m ${remSec}s`;
}

function truncateEnd(text: string, maxLength: number, ellipsis: string): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  if (maxLength <= ellipsis.length) return ellipsis.slice(0, maxLength);
  return `${text.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
}

function truncateMiddlePath(pathText: string, maxLength: number, ellipsis: string): string {
  if (maxLength <= 0) return '';
  if (pathText.length <= maxLength) return pathText;
  if (maxLength <= ellipsis.length + 4) {
    return truncateEnd(pathText, maxLength, ellipsis);
  }
  const available = maxLength - ellipsis.length;
  const head = Math.ceil(available * 0.4);
  const tail = available - head;
  return `${pathText.slice(0, head)}${ellipsis}${pathText.slice(pathText.length - tail)}`;
}

function wrapPlainLine(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || line.length <= maxWidth) {
    return [line];
  }
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > maxWidth) {
    let splitAt = remaining.lastIndexOf(' ', maxWidth);
    if (splitAt <= Math.floor(maxWidth * 0.3)) {
      splitAt = maxWidth;
    }
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

export function createTerminalView(config: TerminalViewConfig): TerminalView {
  let hasAssistantBullet = false;
  let atLineStart = true;
  let progressStartedAt: number | undefined;
  let progressTimer: ReturnType<typeof setInterval> | undefined;
  let progressVisible = false;
  let progressFrame = 0;
  const frames = config.unicode ? ['✶', '✸', '✹', '✷'] : ['|', '/', '-', '\\'];

  const paint = (code: string, text: string): string =>
    config.color && text.length > 0 ? `${code}${text}${ANSI.reset}` : text;

  const getColumns = (): number => {
    const raw = Number(config.columns());
    if (!Number.isFinite(raw) || raw <= 0) return 80;
    return Math.max(24, Math.floor(raw));
  };

  const symbols = () =>
    config.unicode
      ? {
          h: '─',
          star: '✻',
          chevron: '❯',
          bullet: '●',
          tool: '⎿',
          dot: '·',
          warn: '⚠',
          err: '✖',
          info: 'ℹ',
          ellipsis: '…',
        }
      : {
          h: '-',
          star: '*',
          chevron: '>',
          bullet: '*',
          tool: '|-',
          dot: '|',
          warn: '!',
          err: 'x',
          info: 'i',
          ellipsis: '...',
        };

  const clearProgressLine = (): void => {
    if (!progressVisible) return;
    config.write('\r\x1b[2K');
    progressVisible = false;
  };

  const drawProgress = (): void => {
    if (!atLineStart || progressStartedAt === undefined) return;
    clearProgressLine();
    const elapsed = Math.floor((performance.now() - progressStartedAt) / 1000);
    const frame = frames[progressFrame++ % frames.length];
    const label = `  ${frame} Đang suy nghĩ… ${symbols().dot} ${elapsed}s ${symbols().dot} Ctrl+C để dừng`;
    config.write(paint(ANSI.terracotta, truncateEnd(label, getColumns() - 1, symbols().ellipsis)));
    progressVisible = true;
  };

  const stopProgress = (): void => {
    clearInterval(progressTimer);
    progressTimer = undefined;
    clearProgressLine();
  };

  const resumeProgress = (): void => {
    if (
      !config.animateProgress ||
      progressStartedAt === undefined ||
      progressTimer ||
      hasAssistantBullet
    )
      return;
    drawProgress();
    progressTimer = setInterval(drawProgress, 160);
    progressTimer.unref();
  };

  const writeRaw = (text: string): void => {
    if (!text) return;
    clearProgressLine();
    config.write(text);
    atLineStart = text.endsWith('\n');
    if (progressTimer) drawProgress();
  };

  const ensureLineStart = (): string => {
    if (atLineStart) return '';
    atLineStart = true;
    return '\n';
  };

  return {
    welcome(info: TerminalWelcomeInfo): void {
      const s = symbols();
      const cols = getColumns();
      const projectClean = sanitizeInline(info.project) || '.';
      const agentClean = sanitizeInline(info.agent) || 'auto';
      const modelClean = info.model ? sanitizeInline(info.model) : 'mặc định';
      const logo = config.unicode
        ? ['  ▄██▄  ', '▄██████▄', ' ▀▀  ▀▀ ']
        : ['  /\\    ', ' /==\\   ', ' \\__/   '];
      const gap = '   ';
      const budget = cols - logo[0].length - gap.length - 1;
      const rows = [
        paint(ANSI.bold, 'CodeFleet'),
        paint(ANSI.muted, truncateEnd(`${agentClean} ${s.dot} ${modelClean}`, budget, s.ellipsis)),
        paint(ANSI.muted, truncateMiddlePath(projectClean, budget, s.ellipsis)),
      ];
      const header = rows.map((row, index) => paint(ANSI.terracotta, logo[index]) + gap + row);
      const text = '\n' + header.join('\n') + '\n';
      if (config.writeHeader) config.writeHeader(text);
      else writeRaw(ensureLineStart() + text);
    },

    prompt(): string {
      const s = symbols();
      return `${paint(ANSI.terracottaBright, s.chevron)} `;
    },

    footer(agent: string, model?: string, quota?: string): void {
      const s = symbols();
      const cols = getColumns();
      const agentClean = sanitizeInline(agent) || 'auto';
      const modelClean = model ? sanitizeInline(model) : 'mặc định';
      const hint = `  /help${config.completion === false ? '' : ` ${s.dot} Tab`}`;
      const label = `  ${agentClean} ${s.dot} ${modelClean}${quota ? `   ${quota}` : ''}`;
      const fitted = `${truncateEnd(label, cols - hint.length, s.ellipsis)}${hint}`;
      const divider = s.h.repeat(Math.min(cols - 1, 74));
      writeRaw(`${ensureLineStart()}\n${paint(ANSI.dim, divider)}\n${paint(ANSI.muted, fitted)}\n`);
    },

    beginTurn(): void {
      stopProgress();
      hasAssistantBullet = false;
      progressStartedAt = performance.now();
      writeRaw(ensureLineStart());
      if (config.animateProgress) resumeProgress();
      else writeRaw(`  ${symbols().star} Đang suy nghĩ… ${symbols().dot} Ctrl+C để dừng\n`);
    },

    stopProgress,
    resumeProgress,

    status(text: string): void {
      const s = symbols();
      const cols = getColumns();
      const clean = sanitize(text).trim();
      if (!clean) return;

      const prefixPlain = `  ${s.tool} `;
      const budget = Math.max(12, cols - prefixPlain.length);
      const lines = clean.split('\n');
      const formattedLines: string[] = [];

      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const looksLikePath = /[\\/]/.test(trimmed) && !/\s/.test(trimmed);
        const fitted = looksLikePath
          ? truncateMiddlePath(trimmed, budget, s.ellipsis)
          : truncateEnd(trimmed, budget, s.ellipsis);
        formattedLines.push(`${paint(ANSI.terracotta, prefixPlain)}${paint(ANSI.muted, fitted)}`);
      }

      if (formattedLines.length > 0) {
        writeRaw(`${ensureLineStart()}${formattedLines.join('\n')}\n`);
      }
    },

    message(text: string): void {
      const clean = sanitize(text);
      if (!clean) return;
      stopProgress();

      const s = symbols();
      if (!hasAssistantBullet) {
        hasAssistantBullet = true;
        const lead = ensureLineStart();
        const bulletPrefix = `${paint(ANSI.terracottaBright, s.bullet)} `;
        writeRaw(`${lead}${bulletPrefix}${clean}`);
        return;
      }

      writeRaw(clean);
    },

    endTurn(elapsedMs: number, outcome: TerminalTurnOutcome): void {
      stopProgress();
      progressStartedAt = undefined;
      const s = symbols();
      const duration = formatDuration(elapsedMs);
      let label: string;
      let tone: string;
      let icon = s.star;

      if (outcome === 'done') {
        label = `Hoàn tất ${s.dot} ${duration}`;
        tone = ANSI.muted;
      } else if (outcome === 'stopped') {
        label = `Đã dừng ${s.dot} ${duration}`;
        tone = ANSI.amber;
      } else {
        label = `Lỗi xử lý ${s.dot} ${duration}`;
        tone = ANSI.coral;
        icon = s.err;
      }

      const line = `  ${paint(tone, `${icon} ${label}`)}`;
      hasAssistantBullet = false;
      writeRaw(`${ensureLineStart()}${line}\n`);
    },

    permission(title: string): void {
      stopProgress();
      const s = symbols();
      const cols = getColumns();
      const cleanTitle = sanitizeInline(title) || 'Thao tác cần xác nhận';
      const prefixPlain = `${s.warn} Xin quyền: `;
      const budget = Math.max(12, cols - prefixPlain.length);
      const wrapped = wrapPlainLine(cleanTitle, budget);

      const firstLine = `${paint(ANSI.amber, prefixPlain)}${paint(ANSI.bold, wrapped[0] ?? cleanTitle)}`;
      const restLines = wrapped
        .slice(1)
        .map((part) => `${' '.repeat(prefixPlain.length)}${paint(ANSI.bold, part)}`);
      const promptLine = `  ${paint(ANSI.terracotta, s.tool)} ${paint(ANSI.muted, 'Cho phép? [y/N]')}`;

      writeRaw(`${ensureLineStart()}${[firstLine, ...restLines, promptLine].join('\n')}\n`);
    },

    error(text: string): void {
      stopProgress();
      const s = symbols();
      const cols = getColumns();
      const clean = sanitize(text).trim() || 'Đã xảy ra lỗi không xác định.';
      const stripped = clean.replace(/^lỗi:\s*/i, '');
      const prefixPlain = `${s.err} Lỗi: `;
      const budget = Math.max(12, cols - prefixPlain.length);
      const lines = stripped.split('\n').flatMap((line) => wrapPlainLine(line, budget));

      const first = `${paint(ANSI.coral, prefixPlain)}${paint(ANSI.coral, lines[0] ?? stripped)}`;
      const rest = lines
        .slice(1)
        .map((line) => `${' '.repeat(prefixPlain.length)}${paint(ANSI.coral, line)}`);

      writeRaw(`${ensureLineStart()}${[first, ...rest].join('\n')}\n`);
    },

    notice(text: string): void {
      const s = symbols();
      const cols = getColumns();
      const clean = sanitize(text).replace(/^\n+|\n+$/g, '');
      if (!clean.trim()) return;

      const rawLines = clean.split('\n');
      if (rawLines.length === 1) {
        const prefixPlain = `${s.info} `;
        const budget = Math.max(12, cols - prefixPlain.length);
        const line = rawLines[0];
        const fitted =
          /[\\/]/.test(line) && line.length > budget
            ? truncateMiddlePath(line, budget, s.ellipsis)
            : truncateEnd(line, budget, s.ellipsis);
        writeRaw(
          `${ensureLineStart()}${paint(ANSI.terracotta, prefixPlain)}${paint(ANSI.muted, fitted)}\n`,
        );
        return;
      }

      const formatted = rawLines.map((line, idx) => {
        const fitted = truncateEnd(line, cols, s.ellipsis);
        return idx === 0 ? paint(ANSI.terracottaBright, fitted) : paint(ANSI.muted, fitted);
      });
      writeRaw(`${ensureLineStart()}${formatted.join('\n')}\n`);
    },
  };
}
