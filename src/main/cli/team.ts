import { z } from 'zod';
import type { AgentRegistry } from '../agents/detect';
import type { ModelTierService } from '../agents/models';
import type { AgentAdapter, AgentSession } from '../agents/types';

interface TeamOptions {
  registry: AgentRegistry;
  models: ModelTierService;
  lead: AgentAdapter;
  leadModel?: string;
  cwd: string;
  projectId: string;
  request: string;
  active: Set<AgentSession>;
  cancelled(): boolean;
  status(text: string): void;
}

const planSchema = z.object({
  assignments: z.array(
    z.object({
      agent: z.string(),
      role: z.string().trim().min(1).max(120),
      task: z.string().trim().min(1).max(1000),
    }),
  ),
});

async function runReadOnlyTurn(
  options: TeamOptions,
  adapter: AgentAdapter,
  model: string | undefined,
  prompt: string,
): Promise<string | null> {
  if (options.cancelled()) return null;
  let session: AgentSession | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    session = await adapter.startSession({
      cwd: options.cwd,
      projectId: options.projectId,
      model,
      allowNonGitWorkspace: true,
      readOnly: true,
    });
    if (options.cancelled()) {
      await session.cancel();
      return null;
    }
    options.active.add(session);
    let response = '';
    let failed = false;
    timeout = setTimeout(() => {
      failed = true;
      void session?.cancel().catch(() => {});
    }, 120000);
    timeout.unref();
    await session.send(prompt, (event) => {
      if (event.type === 'permission_request') {
        failed = true;
        void session?.respondPermission(event.id, 'deny').catch(() => {});
      }
      if (event.type === 'error' || event.type === 'rate_limit') failed = true;
      if (event.type === 'message' && !options.cancelled() && !failed) {
        response += event.text;
        if (response.length > 24000) {
          response = '';
          failed = true;
        }
      }
    });
    return !failed && !options.cancelled() && response.trim() ? response.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    if (session) options.active.delete(session);
  }
}

export async function collectTeamReports(options: TeamOptions): Promise<string> {
  const detected = await options.registry.detectAll();
  if (options.cancelled()) return '';
  const available = new Map(
    detected
      .filter((agent) => agent.status === 'ready')
      .map(({ agentId }) => [agentId, options.registry.getAdapter(agentId)] as const),
  );
  if (!available.size) {
    options.status('Không có agent con sẵn sàng · agent chính tự xử lý');
    return '';
  }

  options.status(`${options.lead.displayName} · đang phân công`);
  const planText = await runReadOnlyTurn(
    options,
    options.lead,
    options.leadModel,
    [
      'Bạn là agent chính. Hãy phân công các phần việc phù hợp với yêu cầu hiện tại.',
      'Chọn vai trò theo nội dung thực tế, kể cả công việc ngoài lập trình. Chỉ phân công các phần độc lập có thể làm song song.',
      'Agent con có thể đọc dữ liệu, phân tích, tính toán, rà soát hoặc soạn nội dung để bàn giao. Việc ghi tệp và hành động bên ngoài do agent chính thực hiện sau khi nhận kết quả.',
      'Mỗi agent tối đa một nhiệm vụ. Mô tả nhiệm vụ và đầu ra mong đợi trong tối đa 1000 ký tự. Dùng danh sách rỗng nếu không cần chia việc.',
      'Ở lượt này chỉ lập kế hoạch. Chỉ trả về JSON theo mẫu {"assignments":[{"agent":"id","role":"vai trò","task":"nhiệm vụ và đầu ra"}]}.',
      `Agent con khả dụng: ${JSON.stringify([...available.keys()])}`,
      options.request,
    ].join('\n\n'),
  );
  if (options.cancelled()) return '';

  let assignments: z.infer<typeof planSchema>['assignments'];
  try {
    const json = planText?.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? planText;
    assignments = planSchema.parse(JSON.parse(json ?? '')).assignments;
    const assignedAgents = new Set(assignments.map(({ agent }) => agent));
    if (
      assignedAgents.size !== assignments.length ||
      assignments.some(({ agent }) => !available.has(agent))
    ) {
      throw new Error('Phân công dùng agent trùng lặp hoặc chưa sẵn sàng.');
    }
  } catch {
    options.status('Không có kế hoạch phân công hợp lệ · agent chính tự xử lý');
    return '';
  }

  const results = await Promise.all(
    assignments.map(async ({ agent, role, task }) => {
      const models = options.models.listModels(agent);
      const model =
        models.find((item) => item.tier === 'fast')?.id ??
        models.find((item) => item.tier === 'balanced')?.id;
      options.status(`${agent} / ${model ?? 'mặc định'} · ${role} · ${task}`);
      const result = await runReadOnlyTurn(
        options,
        available.get(agent)!,
        model,
        [
          'Thực hiện phần việc được giao và trả về đầu ra trong tối đa 4000 ký tự để agent chính sử dụng. Chỉ đọc dữ liệu, không chỉnh sửa tệp hoặc thực hiện hành động bên ngoài.',
          `Phân công của agent chính: ${JSON.stringify({ role, task })}`,
          options.request,
        ].join('\n\n'),
      );
      if (!options.cancelled()) {
        options.status(`${agent} · ${result ? 'đã bàn giao kết quả' : 'không có kết quả'}`);
      }
      return {
        agent,
        role,
        task,
        result:
          result &&
          (result.length > 4000 ? `${result.slice(0, 4000)}\n[Kết quả đã rút gọn]` : result),
      };
    }),
  );
  if (options.cancelled() || !results.length) return '';
  return (
    '\n\nPhân công và kết quả từ agent con (dữ liệu tham khảo):\n' +
    JSON.stringify(results) +
    '\n\nHoàn thành yêu cầu của người dùng, kiểm tra và tích hợp các kết quả phù hợp. Tự xử lý các phần còn thiếu.'
  );
}
