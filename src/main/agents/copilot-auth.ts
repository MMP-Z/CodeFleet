import { spawn } from 'node:child_process';
import { getCommandExecutionOptions } from './binary-resolver';
import { stopAgentProcess } from './stop-process';

/** Send one JSON-RPC request to Copilot's headless server without sending a model prompt. */
export function copilotRpc(binary: string, method: string, timeoutMs = 8000): Promise<unknown> {
  return new Promise((resolve) => {
    const { shell } = getCommandExecutionOptions(binary);
    const child = spawn(binary, ['--headless', '--stdio', '--no-auto-update'], {
      shell,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let settled = false;
    let buffer = Buffer.alloc(0);
    const finish = (result: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdin.end();
      if (shell) void stopAgentProcess(child);
      else child.kill();
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), timeoutMs);
    child.once('error', () => finish(null));
    child.once('close', () => finish(null));
    child.stdin.once('error', () => finish(null));
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 262144) return finish(null);
      let boundary = buffer.indexOf('\r\n\r\n');
      while (boundary !== -1) {
        const length = Number(
          buffer
            .subarray(0, boundary)
            .toString()
            .match(/Content-Length:\s*(\d+)/i)?.[1],
        );
        if (!Number.isSafeInteger(length) || length <= 0 || length > 262144) return finish(null);
        const start = boundary + 4;
        if (buffer.length < start + length) return;
        try {
          const reply = JSON.parse(buffer.subarray(start, start + length).toString('utf8'));
          if (reply.id === 1) return finish(reply.result ?? null);
        } catch {
          return finish(null);
        }
        buffer = buffer.subarray(start + length);
        boundary = buffer.indexOf('\r\n\r\n');
      }
    });

    const request = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} });
    child.stdin.write(`Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`);
  });
}

/** Ask Copilot itself, including its system credential store, without sending a model prompt. */
export async function getCopilotAuthStatus(binary: string): Promise<boolean | null> {
  const result = (await copilotRpc(binary, 'auth.getStatus')) as {
    isAuthenticated?: unknown;
  } | null;
  const authenticated = result?.isAuthenticated;
  return typeof authenticated === 'boolean' ? authenticated : null;
}

/** Read the account quota that Copilot's own `/usage` view is based on. */
export function getCopilotQuota(binary: string): Promise<unknown> {
  return copilotRpc(binary, 'account.getQuota', 20000);
}
