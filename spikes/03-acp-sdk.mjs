import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { client, methods, ndJsonStream, PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_WS = path.join(__dirname, '.tmp', 'acp-workspace');

function assertInsideWorkspace(workspaceRoot, targetPath) {
  const realRoot = fs.realpathSync(workspaceRoot);
  const resolved = path.resolve(realRoot, targetPath);
  // Resolve parent directory realpath in case file doesn't exist yet (blocks symlink escape!)
  const parentReal = fs.existsSync(path.dirname(resolved))
    ? fs.realpathSync(path.dirname(resolved))
    : path.dirname(resolved);
  const finalCandidate = path.join(parentReal, path.basename(resolved));
  const rel = path.relative(realRoot, finalCandidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new RequestError(-32602, `B4 Path Guard blocked write outside project: ${targetPath}`);
  }
  return finalCandidate;
}

async function main() {
  console.log('=== SPIKE 03: @agentclientprotocol/sdk v2.2.0 Stdio Round-Trip + B4/B5 Guards ===');
  fs.rmSync(path.join(__dirname, '.tmp', 'acp-workspace'), { recursive: true, force: true });
  fs.mkdirSync(TMP_WS, { recursive: true });

  const child = spawn(process.execPath, [path.join(__dirname, '03-mock-acp-agent.mjs')], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  const normalizedEvents = [];
  let blockedOutsideCount = 0;

  const acpClient = client({ name: 'CodeFleet' })
    .onRequest(methods.client.session.requestPermission, async ({ params }) => {
      normalizedEvents.push({
        type: 'permission_request',
        title: params.toolCall.title,
        options: params.options.map((o) => o.optionId),
      });
      return {
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      };
    })
    .onRequest(methods.client.fs.writeTextFile, async ({ params }) => {
      try {
        const safePath = assertInsideWorkspace(TMP_WS, params.path);
        fs.mkdirSync(path.dirname(safePath), { recursive: true });
        fs.writeFileSync(safePath, params.content, 'utf8');
        normalizedEvents.push({ type: 'file_change', path: path.relative(TMP_WS, safePath) });
        return {};
      } catch (err) {
        blockedOutsideCount += 1;
        throw err;
      }
    });

  const stream = ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));

  await acpClient.connectWith(stream, async (ctx) => {
    const initRes = await ctx.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'CodeFleet', title: 'CodeFleet', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
    assert.equal(initRes.agentInfo?.name, 'mock-acp-cli');

    await ctx.buildSession(TMP_WS).withSession(async (session) => {
      const promptPromise = session.prompt('Làm trang chủ tiệm bánh');

      while (true) {
        const msg = await session.nextUpdate();
        if (msg.kind === 'stop') {
          normalizedEvents.push({ type: 'done', stopReason: msg.stopReason });
          break;
        }
        const u = msg.update;
        if (u.sessionUpdate === 'plan') {
          normalizedEvents.push({ type: 'plan', count: u.entries.length });
        } else if (u.sessionUpdate === 'tool_call') {
          normalizedEvents.push({ type: 'tool_call', title: u.title });
        } else if (u.sessionUpdate === 'agent_message_chunk' && u.content.type === 'text') {
          normalizedEvents.push({ type: 'message', text: u.content.text });
        } else if (u.sessionUpdate === 'usage_update') {
          normalizedEvents.push({ type: 'usage', used: u.used, size: u.size });
        }
      }

      const finalRes = await promptPromise;
      assert.equal(finalRes.stopReason, 'end_turn');

      // Test rate_limit detection over ACP JSON-RPC error
      let caughtRateLimit = false;
      try {
        await session.prompt('TRIGGER_RATE_LIMIT');
      } catch (err) {
        if (String(err?.message || err).includes('429')) {
          caughtRateLimit = true;
          normalizedEvents.push({ type: 'rate_limit', resetsAt: '00:00Z' });
        }
      }
      assert.equal(caughtRateLimit, true, 'Must detect 429 rate limit from ACP session/prompt');
    });
  });

  child.kill();

  assert.equal(blockedOutsideCount, 1, 'Luật B4 path guard must block write outside workspace');
  assert.equal(
    fs.existsSync(path.resolve(TMP_WS, '..', 'escaped-secret.txt')),
    false,
    'Forbidden outside file must NOT exist on disk',
  );
  assert.equal(fs.existsSync(path.join(TMP_WS, 'index.html')), true, 'Valid inside file must exist');

  const eventTypes = normalizedEvents.map((e) => e.type);
  for (const expected of ['plan', 'permission_request', 'file_change', 'tool_call', 'message', 'done', 'rate_limit']) {
    assert.ok(eventTypes.includes(expected), `Missing normalized event: ${expected}`);
  }

  fs.rmSync(TMP_WS, { recursive: true, force: true });
  console.log('[PASS] ACP stdio handshake, streaming updates, B5 permission request, B4 path guard, and 429 rate_limit verified.');
  console.log('Normalized events captured:', eventTypes.join(' -> '));
  console.log('=== ALL ACP SDK SPIKE TESTS PASSED ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

