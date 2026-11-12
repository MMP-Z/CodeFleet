import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { stopAgentProcess } from './stop-process';

it('terminates the CLI process owned by this session', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const closed = once(child, 'close');
  try {
    await once(child, 'spawn');
    await stopAgentProcess(child);
    await closed;
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    await stopAgentProcess(child); // Already stopped is harmless.
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
});
