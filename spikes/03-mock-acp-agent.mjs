import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { agent, methods, ndJsonStream, PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk';

let sessionCounter = 0;
const sessions = new Map();

const mockAgent = agent({ name: 'mock-acp-cli' })
  .onRequest(methods.agent.initialize, ({ params }) => ({
    protocolVersion: params.protocolVersion ?? PROTOCOL_VERSION,
    agentInfo: { name: 'mock-acp-cli', title: 'Mock ACP CLI', version: '1.0.0' },
    agentCapabilities: { loadSession: true },
  }))
  .onRequest(methods.agent.session.new, ({ params }) => {
    const sessionId = `sess_${++sessionCounter}`;
    sessions.set(sessionId, { cwd: params.cwd });
    return { sessionId };
  })
  .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
    const sess = sessions.get(params.sessionId);
    const firstBlock = params.prompt[0];
    const text = firstBlock && firstBlock.type === 'text' ? firstBlock.text : '';

    if (text.includes('TRIGGER_RATE_LIMIT')) {
      throw new RequestError(-32000, '429 RESOURCE_EXHAUSTED: Quota exceeded for model, resets at 00:00Z');
    }

    // 1. Emit Plan
    await client.notify(methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'plan',
        entries: [
          { content: 'Tạo trang chủ index.html', priority: 'high', status: 'in_progress' },
        ],
      },
    });

    // 2. Request Permission (Luật B5 / MH-04)
    const permRes = await client.request(methods.client.session.requestPermission, {
      sessionId: params.sessionId,
      toolCall: {
        toolCallId: 'tc_install_1',
        title: 'npm install bcrypt',
        kind: 'execute',
      },
      options: [
        { optionId: 'allow_once', name: 'Cho phép lần này', kind: 'allow_once' },
        { optionId: 'reject_once', name: 'Không cho phép', kind: 'reject_once' },
      ],
    });

    if (permRes.outcome.outcome !== 'selected' || permRes.outcome.optionId !== 'allow_once') {
      return { stopReason: 'cancelled' };
    }

    // 3. Attempt forbidden write OUTSIDE cwd (Luật B4 test)
    let outsideBlocked = false;
    try {
      await client.request(methods.client.fs.writeTextFile, {
        sessionId: params.sessionId,
        path: path.resolve(sess.cwd, '..', 'escaped-secret.txt'),
        content: 'should never be written',
      });
    } catch {
      outsideBlocked = true;
    }

    // 4. Perform valid write INSIDE cwd
    const validFile = path.resolve(sess.cwd, 'index.html');
    await client.request(methods.client.fs.writeTextFile, {
      sessionId: params.sessionId,
      path: validFile,
      content: '<!doctype html><h1>Tiệm Bánh Nhỏ</h1>\n',
    });

    // 5. Emit ToolCall + Message chunk + UsageUpdate
    await client.notify(methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tc_write_1',
        title: 'Ghi file index.html',
        kind: 'edit',
        status: 'completed',
      },
    });

    await client.notify(methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `Đã tạo xong index.html (chặn ghi ngoài dự án: ${outsideBlocked}).`,
        },
      },
    });

    await client.notify(methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'usage_update',
        used: 1420,
        size: 200000,
      },
    });

    return { stopReason: 'end_turn' };
  });

const stream = ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
mockAgent.connect(stream);

