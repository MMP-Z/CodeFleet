import { describe, expect, it, vi } from 'vitest';
import { completeCommand } from './completion';
import { terminalText } from './options';
import { createTerminalView } from './terminal-view';

describe('interactive CLI presentation', () => {
  it('updates the waiting indicator and stops it before streaming the response', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date', 'performance'] });
    try {
      const write = vi.fn<(text: string) => void>();
      const view = createTerminalView({
        write,
        columns: () => 80,
        color: false,
        unicode: true,
        animateProgress: true,
      });
      view.beginTurn();
      const initialWrites = write.mock.calls.length;
      vi.advanceTimersByTime(2000);
      expect(write.mock.calls.slice(initialWrites).join('')).toContain('Đang suy nghĩ');

      view.message('Xin chào');
      const responseWrites = write.mock.calls.length;
      vi.advanceTimersByTime(2000);
      expect(write).toHaveBeenCalledTimes(responseWrites);
      view.endTurn(4000, 'done');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the welcome header readable on a narrow terminal without ANSI or box glyphs', () => {
    let output = '';
    const view = createTerminalView({
      write: (text) => {
        output += text;
      },
      columns: () => 34,
      color: false,
      unicode: false,
    });
    view.welcome({
      project: 'D:\\PROJECT\\very-long-folder-name\\CODEFLEET',
      agent: 'codex',
    });
    expect(output).toContain('CodeFleet');
    expect(output).toContain('codex');
    expect(output).not.toContain('\x1b');
    expect(output).not.toMatch(/[┌┐└┘─│]/);
    expect(output.split('\n').every((line) => line.length <= 34)).toBe(true);
  });

  it('streams assistant text without splitting words or executing control sequences', () => {
    let output = '';
    const view = createTerminalView({
      write: (text) => {
        output += text;
      },
      columns: () => 80,
      color: true,
      unicode: true,
    });
    view.beginTurn();
    view.message('Xin ');
    view.message('\x1b]52;c;payload\x07chào\n  code');
    view.endTurn(350, 'done');
    expect(terminalText(output)).toContain('Xin chào\n  code');
    expect(output).not.toContain('payload');
  });

  it('completes slash commands and real agent IDs without touching plain prompts', () => {
    const ids = ['codex', 'agy'];
    expect(completeCommand('/he', ids)).toEqual([['/help'], '/he']);
    expect(completeCommand('/agent ag', ids)).toEqual([['/agent agy'], '/agent ag']);
    expect(completeCommand('explain this', ids)).toEqual([[], 'explain this']);
  });
});
