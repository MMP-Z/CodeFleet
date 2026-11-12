import { Writable } from 'node:stream';
import type { WriteStream } from 'node:tty';
import { terminalText } from './options';

interface ComposerState {
  draft: string;
  cursor: number;
  status: string;
  prompt: string;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const reset = '\x1b[0m';
// The view only emits SGR colors and its own clear-line command.
// eslint-disable-next-line no-control-regex
const sgr = /(\x1b\[[0-9;]*m)/;

function width(glyph: string): number {
  if (/^\p{Mark}+$/u.test(glyph)) return 0;
  return /[\p{Extended_Pictographic}\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff01-\uff60]/u.test(
    glyph,
  )
    ? 2
    : 1;
}

function wrap(text: string, columns: number): string[] {
  const lines = [];
  let style = '';
  let line = '';
  let used = 0;
  for (const part of text.replace(/\t/g, '    ').split(sgr)) {
    if (part.startsWith('\x1b[')) {
      style = part === reset ? '' : style + part;
      line += part;
      continue;
    }
    for (const { segment } of segmenter.segment(part)) {
      const cells = width(segment);
      if (used + cells > columns) {
        lines.push(line);
        line = style;
        used = 0;
      }
      line += segment;
      used += cells;
    }
  }
  lines.push(line);
  return lines;
}

function sliceDraft(
  draft: string,
  cursor: number,
  columns: number,
): { text: string; caret: number } {
  const glyphs = Array.from(segmenter.segment(draft.replace(/[\t\r\n]/g, ' ')));
  let caret = 0;
  let start = 0;
  let end = 0;
  while (end < glyphs.length && glyphs[end].index < cursor) {
    caret += width(glyphs[end++].segment);
    while (caret >= columns) caret -= width(glyphs[start++].segment);
  }
  let used = caret;
  while (end < glyphs.length && used + width(glyphs[end].segment) <= columns) {
    used += width(glyphs[end++].segment);
  }
  return {
    text: glyphs
      .slice(start, end)
      .map(({ segment }) => segment)
      .join(''),
    caret,
  };
}

export function createTerminalScreen(stdout: WriteStream, color: boolean, unicode: boolean) {
  const history: { text: string; columns?: number; rows?: string[] }[] = [];
  let headerLines = 0;
  let tail = '';
  let offset = 0;
  let frame: string[] = [];
  let pending: NodeJS.Immediate | undefined;
  let pendingInput: NodeJS.Timeout | undefined;
  let open = true;
  let getComposer: () => ComposerState = () => ({ draft: '', cursor: 0, status: '', prompt: '> ' });

  function render(): void {
    const columns = stdout.columns - 1;
    const rows = stdout.rows;
    if (columns < 12 || rows < 6) {
      stdout.write('\x1b[?25l\x1b[2J\x1b[HMở rộng terminal để tiếp tục.');
      frame = [];
      return;
    }
    const contentHeight = rows - 4;
    const content: string[] = [];
    let skipped = 0;
    const tailRows = tail ? wrap(tail, columns) : [];
    for (let i = history.length; i >= 0 && content.length < contentHeight; i--) {
      const entry = history[i];
      if (entry && entry.columns !== columns) {
        entry.columns = columns;
        entry.rows = wrap(entry.text, columns);
      }
      const lines = entry?.rows ?? tailRows;
      for (let j = lines.length - 1; j >= 0 && content.length < contentHeight; j--) {
        if (skipped++ >= offset) content.push(lines[j]);
      }
    }
    if (content.length < contentHeight && offset > 0) {
      offset = Math.max(0, skipped - contentHeight);
      return render();
    }
    const next = content.reverse();
    while (next.length < contentHeight) next.push('');

    const state = getComposer();
    const prompt = terminalText(state.prompt);
    const draft = sliceDraft(terminalText(state.draft), state.cursor, columns - prompt.length);
    const divider = (unicode ? '─' : '-').repeat(columns);
    const muted = (text: string): string => (color ? '\x1b[38;5;245m' + text : text);
    const status = offset ? state.status + ' · ↓ PgDn để về cuối' : state.status;
    next.push(
      muted(divider),
      prompt + draft.text,
      muted(divider),
      muted(wrap(terminalText(status), columns)[0]),
    );
    let output = '\x1b[?25l';
    next.forEach((line, i) => {
      if (frame[i] !== line) output += '\x1b[' + (i + 1) + ';1H\x1b[2K' + line + reset;
    });
    frame = next;
    stdout.write(
      output +
        '\x1b[' +
        (contentHeight + 2) +
        ';' +
        (prompt.length + draft.caret + 1) +
        'H\x1b[?25h',
    );
  }

  function refresh(): void {
    if (!open || pending) return;
    pending = setImmediate(() => {
      pending = undefined;
      if (open) render();
    });
  }

  function refreshInput(): void {
    // Vietnamese IMEs can replace a typed letter with backspace and a Unicode
    // character in separate events. Paint after the input burst.
    if (!open || pendingInput) return;
    pendingInput = setTimeout(() => {
      pendingInput = undefined;
      refresh();
    }, 20);
  }

  function write(text: string): void {
    if (text === '\r\x1b[2K') {
      tail = '';
    } else {
      const lines = (tail + text).split('\n');
      tail = lines.pop() ?? '';
      for (const line of lines) history.push({ text: line });
      if (history.length > 3000) history.splice(headerLines, history.length - 3000);
    }
    refresh();
  }

  const inputOutput = new Writable({
    write(_chunk, _encoding, callback) {
      refreshInput();
      callback();
    },
  });
  Object.defineProperty(inputOutput, 'columns', { get: () => stdout.columns });

  function resize(): void {
    frame = [];
    stdout.write('\x1b[2J');
    refresh();
  }
  function close(): void {
    if (!open) return;
    open = false;
    if (pending) clearImmediate(pending);
    clearTimeout(pendingInput);
    stdout.off('resize', resize);
    process.off('exit', close);
    stdout.write('\x1b[?2004l\x1b[?1006l\x1b[?1000l\x1b[0m\x1b[?25h\x1b[?1049l');
  }
  stdout.write('\x1b[?1049h\x1b[2J');
  stdout.on('resize', resize);
  process.once('exit', close);

  return {
    inputOutput,
    write,
    refresh,
    refreshInput,
    close,
    enableMouse(): void {
      stdout.write('\x1b[?1000h\x1b[?1006h\x1b[?2004h');
    },
    setHeader(text: string): void {
      const rows = text.split('\n');
      if (rows.at(-1) === '') rows.pop();
      history.splice(0, headerLines, ...rows.map((row) => ({ text: row })));
      headerLines = rows.length;
      refresh();
    },
    setComposer(read: () => ComposerState): void {
      getComposer = read;
      refresh();
    },
    submit(text: string): void {
      offset = 0;
      const label = (unicode ? '❯ ' : '> ') + terminalText(text);
      write('\n' + (color ? '\x1b[1;38;5;255;48;5;237m' + label + reset : label) + '\n');
    },
    scroll(direction: number, lines = Math.max(1, stdout.rows - 6)): void {
      offset = Math.max(0, offset + direction * lines);
      refresh();
    },
  };
}
