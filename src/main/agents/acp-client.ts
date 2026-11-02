import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
} from '@agentclientprotocol/sdk';
import { assertPathInsideProject, writeProjectFileSafe } from '../security/path-guard';
import type { AgentEvent, PermissionHandler } from './types';

export interface AcpClientBridgeOptions {
  cwd: string;
  onEvent?: (event: AgentEvent) => void;
  onPermissionRequest?: PermissionHandler;
}

export interface AcpSessionRunOptions {
  prompt: string;
  model?: string | null;
  resumeSessionId?: string;
  onEvent?: (event: AgentEvent) => void;
}

export interface AcpSessionRunResult {
  sessionId: string;
  stopReason: string;
  outputTokens?: number;
  inputTokens?: number;
}

/**
 * Cầu nối ACP Client (Agent Client Protocol v1) qua luồng stdio của subprocess CLI.
 * Tích hợp Luật B4 (Path Guard) chặn triệt để ghi file ra ngoài thư mục dự án
 * và Luật B5 (xin phép trước các hành động rủi ro).
 */
export class AcpClientBridge {
  private readonly cwd: string;
  private readonly onPermissionRequest?: PermissionHandler;

  public constructor(options: AcpClientBridgeOptions) {
    this.cwd = path.resolve(options.cwd);
    this.onPermissionRequest = options.onPermissionRequest;
  }

  /**
   * Chạy một lượt hội thoại hoàn chỉnh qua ACP stdio stream của tiến trình con.
   */
  public async runSession(
    child: ChildProcess,
    options: AcpSessionRunOptions,
  ): Promise<AcpSessionRunResult> {
    if (!child.stdin || !child.stdout) {
      throw new Error('Child process must have piped stdin and stdout for ACP communication');
    }

    const eventHandler = options.onEvent ?? (() => {});
    let activeSessionId = options.resumeSessionId ?? '';
    let stopReason = 'end_turn';
    const totalInputTokens = 0;
    let totalOutputTokens = 0;

    const acpClient = client({
      name: 'CodeFleet',
    })
      .onRequest(methods.client.session.requestPermission, async ({ params }) => {
        const title = params.toolCall?.title ?? 'Hành động rủi ro cần xin phép';
        const optionsList = params.options.map((opt) => opt.optionId);
        eventHandler({
          type: 'permission_request',
          id: params.toolCall?.toolCallId ?? `req_${Date.now()}`,
          title,
          options: optionsList,
        });

        if (this.onPermissionRequest) {
          const chosenOption = await this.onPermissionRequest({
            id: params.toolCall?.toolCallId ?? `req_${Date.now()}`,
            title,
            options: optionsList,
          });
          return {
            outcome: { outcome: 'selected', optionId: chosenOption },
          };
        }

        // Mặc định cho phép một lần nếu không có handler riêng
        const firstAllow =
          optionsList.find((o) => o.includes('allow')) ?? optionsList[0] ?? 'allow_once';
        return {
          outcome: { outcome: 'selected', optionId: firstAllow },
        };
      })
      .onRequest(methods.client.fs.writeTextFile, async ({ params }) => {
        try {
          // LUẬT B4: Kiểm tra và chặn thoát khỏi thư mục dự án
          const safePath = assertPathInsideProject(this.cwd, params.path);
          writeProjectFileSafe(this.cwd, params.path, params.content);
          const relativePath = path.relative(this.cwd, safePath).replace(/\\/g, '/');
          eventHandler({
            type: 'file_change',
            path: relativePath,
          });
          return {};
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Trả về lỗi JSON-RPC chuẩn cho AI
          throw new RequestError(-32602, message);
        }
      })
      .onRequest(methods.client.fs.readTextFile, async ({ params }) => {
        const safePath = assertPathInsideProject(this.cwd, params.path);
        const content = fs.readFileSync(safePath, 'utf8');
        return { content };
      });

    const stream = ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
    );

    try {
      await acpClient.connectWith(stream, async (ctx) => {
        await ctx.request(methods.agent.initialize, {
          protocolVersion: PROTOCOL_VERSION,
          clientInfo: { name: 'CodeFleet', title: 'CodeFleet', version: '0.1.0' },
          clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
          },
        });

        await ctx.buildSession(this.cwd).withSession(async (session) => {
          activeSessionId = session.sessionId;

          const promptPromise = session.prompt(options.prompt);

          while (true) {
            const msg = await session.nextUpdate();
            if (msg.kind === 'stop') {
              stopReason = msg.stopReason;
              break;
            }

            const u = msg.update;
            if (u.sessionUpdate === 'plan') {
              eventHandler({
                type: 'plan',
                steps: u.entries.map((e) => ({
                  title: e.content,
                  status: e.status ?? 'in_progress',
                })),
              });
            } else if (u.sessionUpdate === 'tool_call') {
              eventHandler({
                type: 'tool_call',
                id: u.toolCallId,
                kind: u.kind ?? 'tool',
                title: u.title ?? 'Thực thi công cụ',
                status: u.status ?? 'completed',
              });
            } else if (u.sessionUpdate === 'agent_message_chunk' && u.content.type === 'text') {
              eventHandler({
                type: 'message',
                text: u.content.text,
              });
            } else if (u.sessionUpdate === 'usage_update') {
              totalOutputTokens = u.used ?? totalOutputTokens;
            }
          }

          const promptResult = await promptPromise;
          stopReason = promptResult.stopReason ?? stopReason;
        });
      });

      eventHandler({
        type: 'done',
        externalSessionId: activeSessionId,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      });

      return {
        sessionId: activeSessionId,
        stopReason,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit')) {
        eventHandler({
          type: 'rate_limit',
          model: options.model ?? undefined,
        });
      } else {
        eventHandler({
          type: 'error',
          message: errMsg,
        });
      }
      throw err;
    }
  }
}
