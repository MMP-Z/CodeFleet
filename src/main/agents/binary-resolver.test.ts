import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  getAgentBinaryCandidates,
  getCommandExecutionOptions,
  resolveAgentBinary,
} from './binary-resolver';

describe('binary-resolver', () => {
  it('returns candidate paths for codex, claude, copilot, agy', () => {
    const codexCandidates = getAgentBinaryCandidates('codex');
    const claudeCandidates = getAgentBinaryCandidates('claude');
    const copilotCandidates = getAgentBinaryCandidates('copilot');
    const agyCandidates = getAgentBinaryCandidates('agy');

    expect(codexCandidates.length).toBeGreaterThan(1);
    expect(claudeCandidates.length).toBeGreaterThan(1);
    expect(copilotCandidates.length).toBeGreaterThan(1);
    expect(agyCandidates.length).toBeGreaterThan(1);

    expect(codexCandidates).toContain('codex');
    expect(claudeCandidates).toContain('claude');
    expect(copilotCandidates).toContain('copilot');
    expect(agyCandidates).toContain('agy');
  });

  it('determines proper shell execution options', () => {
    if (process.platform === 'win32') {
      expect(getCommandExecutionOptions('C:\\Path With Spaces\\tool.exe')).toEqual({
        shell: false,
      });
      expect(getCommandExecutionOptions('C:\\tools\\run.cmd')).toEqual({ shell: true });
      expect(getCommandExecutionOptions('codex')).toEqual({ shell: true });
    } else {
      expect(getCommandExecutionOptions('/usr/bin/codex')).toEqual({ shell: false });
    }
  });

  it('resolves agent binary gracefully', () => {
    const codexBinary = resolveAgentBinary('codex');
    expect(typeof codexBinary).toBe('string');
    expect(codexBinary.length).toBeGreaterThan(0);
  });

  it('skips the private Codex sandbox copy even when it comes first on PATH', () => {
    const privateDir = path.join(os.homedir(), '.codex', '.sandbox-bin');
    const publicDir = path.join(os.homedir(), 'Codex installation', 'resources');
    const name = process.platform === 'win32' ? 'codex.exe' : 'codex';
    const installed = [path.join(privateDir, name), path.join(publicDir, name)];
    vi.stubEnv('PATH', [privateDir, publicDir].join(path.delimiter));
    const exists = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((file) => installed.includes(String(file)));
    try {
      expect(resolveAgentBinary('codex')).toBe(installed[1]);
    } finally {
      exists.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
