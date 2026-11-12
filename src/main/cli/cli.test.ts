import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentAdapter, AgentEvent, AgentSession, DetectResult } from '../agents/types';
import { CliRuntime } from './runtime';
import { parseOptions, terminalText } from './options';
import { formatEvent } from './presentation';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
});

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-cli-'));
  cleanup.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  const send = vi.fn(async (_prompt: string, emit: (event: AgentEvent) => void) => {
    emit({ type: 'message', text: 'Xin chào' });
    emit({ type: 'done' });
  });
  const respondPermission = vi.fn(async () => {});
  const cancel = vi.fn(async () => {});
  const startSession = vi.fn(
    async () =>
      ({
        id: 'session',
        agentId: 'codex',
        cwd: dir,
        model: null,
        getExternalSessionId: () => null,
        send,
        cancel,
        respondPermission,
      }) satisfies AgentSession,
  );
  const adapter = {
    id: 'codex',
    displayName: 'Codex',
    shortName: 'GPT',
    logoLetter: 'G',
    color: '#fff',
    darkColor: '#fff',
    docsUrl: 'https://example.com',
    installCommand: '',
    loginCommand: '',
    detect: vi.fn(),
    listModels: vi.fn(),
    getQuota: vi.fn(),
    startSession,
  } as unknown as AgentAdapter;
  const runtime = new CliRuntime(
    { project: dir, dataDir: path.join(dir, 'data'), agent: 'codex', help: false, agents: false },
    [adapter],
  );
  cleanup.push(() => runtime.close());
  const io = { message: vi.fn(), status: vi.fn(), permission: vi.fn(async () => false) };
  return { runtime, send, startSession, respondPermission, cancel, io, dir };
}

describe('Node CLI', () => {
  it('dispatches the lead’s CAD assignments in parallel before completing the request', async () => {
    const { runtime, send, startSession, io } = fixture();
    const lead = await startSession();
    const codex = runtime.registry.getAdapter('codex');
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const plan = vi.fn(async (_prompt: string, emit: (event: AgentEvent) => void) => {
      emit({
        type: 'message',
        text:
          '```json\n' +
          JSON.stringify({
            assignments: [
              { agent: 'codex', role: 'Rà soát kích thước', task: 'Liệt kê kích thước gá đỡ.' },
              { agent: 'agy', role: 'Dựng hình', task: 'Soạn macro FreeCAD.' },
            ],
          }) +
          '\n```',
      });
    });
    const worker = vi.fn(async (_prompt: string, emit: (event: AgentEvent) => void) => {
      await gate;
      emit({ type: 'message', text: 'Kết quả CAD' });
    });
    vi.spyOn(codex, 'startSession')
      .mockResolvedValueOnce(lead)
      .mockImplementationOnce(async (opts) => {
        expect(opts.readOnly).toBe(true);
        return { ...lead, send: plan };
      })
      .mockImplementationOnce(async (opts) => {
        expect(opts.readOnly).toBe(true);
        return { ...lead, send: worker };
      });
    runtime.registry.register({
      ...codex,
      id: 'agy',
      startSession: async (opts) => {
        expect(opts.readOnly).toBe(true);
        return { ...lead, agentId: 'agy', send: worker };
      },
    });
    vi.spyOn(runtime.registry, 'detectAll').mockResolvedValue([
      { agentId: 'codex', status: 'ready' } as DetectResult,
      { agentId: 'agy', status: 'ready' } as DetectResult,
      { agentId: 'copilot', status: 'not_logged_in' } as DetectResult,
    ]);
    const turn = runtime.send('Dựng mô hình gá đỡ CAD', io, 'subagent');
    try {
      await vi.waitFor(() => expect(worker).toHaveBeenCalledTimes(2));
      expect(plan.mock.calls[0][0]).toContain('["codex","agy"]');
      expect(worker.mock.calls[0][0]).toContain('Liệt kê kích thước gá đỡ.');
      expect(worker.mock.calls[1][0]).toContain('Soạn macro FreeCAD.');
      expect(send).not.toHaveBeenCalled();
    } finally {
      release();
      await turn;
    }
    expect(send.mock.calls[0][0]).toContain('Dựng mô hình gá đỡ CAD');
    expect(send.mock.calls[0][0]).toContain('"agent":"codex"');
    expect(send.mock.calls[0][0]).toContain('"agent":"agy"');
    expect(send.mock.calls[0][0]).toContain('Kết quả CAD');
    expect(io.message).toHaveBeenCalledExactlyOnceWith('Xin chào');
  });

  it('falls back to the lead when the plan names an unavailable agent', async () => {
    const { runtime, send, startSession, io } = fixture();
    vi.spyOn(runtime.registry, 'detectAll').mockResolvedValue([
      { agentId: 'codex', status: 'ready' } as DetectResult,
    ]);
    send.mockImplementationOnce(async (_prompt, emit) => {
      emit({
        type: 'message',
        text: '{"assignments":[{"agent":"agy","role":"Reviewer","task":"Check dimensions"}]}',
      });
    });
    await runtime.send('Kiểm tra bản vẽ', io, 'subagent');
    expect(startSession).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe('Kiểm tra bản vẽ');
    expect(io.message).toHaveBeenCalledExactlyOnceWith('Xin chào');
  });

  it('parses print, project and model options and rejects invalid flags', () => {
    expect(
      parseOptions(['--agent', 'agy', '-p', 'a & b', '--project', 'D:\\a b', '--model', 'model']),
    ).toMatchObject({ agent: 'agy', prompt: 'a & b', project: 'D:\\a b', model: 'model' });
    expect(() => parseOptions(['--unknown'])).toThrow();
    expect(() => parseOptions(['--agent'])).toThrow();
  });

  it('removes terminal escape payloads while preserving Vietnamese and lines', () => {
    expect(terminalText('\x1b[31mXin chào\x1b[0m\n\x1b]52;c;payload\x07ok')).toBe('Xin chào\nok');
    expect(
      formatEvent({ type: 'log_entry', data: { source: 'agy', text: '\x1b[2Jhello' } }),
    ).not.toContain('\x1b');
    expect(formatEvent({ type: 'permission_requested', data: null })).toBe('');
  });

  it('sends the exact prompt, streams responses and saves both messages', async () => {
    const { runtime, send, startSession, io } = fixture();
    await runtime.send('giải thích a & b', io);
    expect(send.mock.calls[0][0]).toBe('giải thích a & b');
    expect(io.message).toHaveBeenCalledWith('Xin chào');
    expect(runtime.conversations.listMessages(runtime.conversationId).map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ]);
    await runtime.send('tiếp tục', io);
    expect(startSession).toHaveBeenCalledTimes(1);
    runtime.newConversation();
    await runtime.send('mới', io);
    expect(startSession).toHaveBeenCalledTimes(2);
  });

  it('restores stored context to a new session and validates resume project', async () => {
    const { runtime, startSession, send, io, dir } = fixture();
    await runtime.send('ngữ cảnh cũ', io);
    const resumed = new CliRuntime(
      {
        project: dir,
        dataDir: path.join(dir, 'data'),
        agent: 'codex',
        resume: runtime.conversationId,
        help: false,
        agents: false,
      },
      [runtime.registry.getAdapter('codex')],
    );
    cleanup.push(() => resumed.close());
    await resumed.send('câu tiếp', io);
    expect(startSession).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toContain('ngữ cảnh cũ');
    expect(send.mock.calls[1][0]).toContain('câu tiếp');
  });

  it('denies permissions through the adapter and reports agent failures', async () => {
    const { runtime, send, respondPermission, io } = fixture();
    send.mockImplementationOnce(async (_prompt, emit) => {
      emit({ type: 'permission_request', id: 'p1', title: 'Run command', options: ['allow'] });
      emit({ type: 'done' });
    });
    await runtime.send('test permission', io);
    expect(respondPermission).toHaveBeenCalledWith('p1', 'deny');
    send.mockImplementationOnce(async (_prompt, emit) => {
      emit({ type: 'error', message: 'broken' });
    });
    await expect(runtime.send('test error', io)).rejects.toThrow('broken');
  });

  it('cancels the active session', async () => {
    const { runtime, send, cancel, io } = fixture();
    let finish!: () => void;
    send.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const turn = runtime.send('long task', io);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    await runtime.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
    finish();
    await turn;
  });
});
