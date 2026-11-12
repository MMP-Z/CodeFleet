import { execFile, type ChildProcess } from 'node:child_process';

/** Stop only the process tree belonging to this session, including Windows CLI wrappers. */
export async function stopAgentProcess(child: ChildProcess | null): Promise<void> {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () =>
        resolve(),
      );
    });
  } else child.kill('SIGTERM');
}
