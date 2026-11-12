import { createInterface } from 'node:readline';
import type { DetectResult, QuotaSnapshot } from '../agents/types';
import { completeCommand } from './completion';
import { parseMode, parseOptions, terminalText } from './options';
import { HELP } from './presentation';
import { quotaLabel } from './quota-label';
import type { CliRuntime } from './runtime';
import { runSkillCommand } from './skill-command';
import { SkillService } from './skills';
import { createTerminalScreen } from './terminal-screen';
import { createTerminalInput } from './terminal-input';
import { createTerminalView } from './terminal-view';
import { composeVietnamese, parseInputMode } from './vietnamese-input';

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  let screen: ReturnType<typeof createTerminalScreen> | undefined;
  let savedTitle = false;
  const write = (text: string): void => {
    const clean = terminalText(text);
    if (screen) screen.write(clean);
    else process.stdout.write(clean);
  };
  const line = (text: string): void => write(`${text}\n`);
  if (options.help) {
    line(
      `CodeFleet CLI\n\ncodefleet [--project <folder>] [--agent <id>] [--model <id>]\ncodefleet --print "yêu cầu"\ncodefleet --agents\ncodefleet --models [--agent <id|auto>]\ncodefleet --resume <conversation-id>\n\n--data-dir <folder>  Thư mục dữ liệu CLI (mặc định ~/.codefleet)\n--help               Trợ giúp\n\n${HELP}`,
    );
    line('--codex-sandbox <mode>  Chọn sandbox của Codex cho phiên CLI này');
    return;
  }
  if (!options.prompt && !options.agents && !options.models && !process.stdin.isTTY) {
    throw new Error('Dùng --print, --agents hoặc --models khi chạy ngoài terminal tương tác.');
  }
  const { CliRuntime: Runtime } = await import('./runtime');
  const runtime: CliRuntime = new Runtime(options);
  const skills = new SkillService({ projectDir: options.project });
  const showAgent = (agent: DetectResult): void => {
    line(`${agent.agentId.padEnd(10)} ${agent.status} ${agent.version ?? ''}`.trimEnd());
    if (agent.status === 'not_installed') {
      line(`  Gợi ý cài đặt  ${agent.installCommand}`);
      line(`  Hướng dẫn     ${agent.docsUrl}`);
    } else if (agent.status === 'not_logged_in') {
      line(`  Đăng nhập     ${agent.loginCommand}`);
    }
  };
  const showAgents = async (): Promise<void> => {
    line('Đang kiểm tra AI CLI...');
    for (const agent of await runtime.registry.detectAll()) showAgent(agent);
  };
  const showModels = async (agentId = options.agent): Promise<void> => {
    line('Đang kiểm tra model...');
    const agents = await runtime.registry.detectAll(agentId === 'auto' ? undefined : agentId);
    for (const agent of agents) {
      showAgent(agent);
      if (agent.status !== 'ready') continue;
      const models = runtime.models.listModels(agent.agentId);
      if (!models.length) {
        line('  Chưa tìm thấy model.');
        continue;
      }
      line('  Danh sách model từ CLI, bộ nhớ đệm hoặc danh mục mặc định');
      for (const model of models) {
        const selected = agent.agentId === options.agent && model.id === options.model;
        line(`  ${model.id}${selected ? '  (đang chọn)' : ''}`);
      }
      if (
        agent.agentId === options.agent &&
        options.model &&
        !models.some((model) => model.id === options.model)
      ) {
        line(`  Model đang chọn ${options.model} chưa xuất hiện trong danh sách.`);
      }
    }
  };
  try {
    if (options.agents) {
      await showAgents();
      return;
    }
    if (options.models) {
      await showModels();
      return;
    }
    if (options.prompt !== undefined) {
      const onSignal = (): void => {
        void runtime.cancel();
        process.exitCode = 130;
      };
      process.on('SIGINT', onSignal);
      try {
        await runtime.send(options.prompt, {
          message: write,
          status: (text) => process.stderr.write(`${terminalText(text)}\n`),
          permission: async (title) => {
            process.stderr.write(`Từ chối quyền trong chế độ --print: ${terminalText(title)}\n`);
            return false;
          },
        });
        line('');
      } finally {
        process.off('SIGINT', onSignal);
      }
      return;
    }
    const dumbTerminal = process.env.TERM === 'dumb';
    const canSetTitle = process.stdout.isTTY && !dumbTerminal;
    const syncTitle = (): void => {
      if (!canSetTitle) return;
      const agent = terminalText(options.agent).replace(/[\r\n\t]/g, ' ');
      process.stdout.write('\x1b]0;CodeFleet · ' + agent + '\x07');
    };
    if (canSetTitle) {
      process.stdout.write('\x1b[22;0t');
      savedTitle = true;
      syncTitle();
    }
    const color = Boolean(
      process.stdout.isTTY && !dumbTerminal && process.env.NO_COLOR === undefined,
    );
    const unicode = !dumbTerminal && process.env.CODEFLEET_ASCII !== '1';
    if (process.stdout.isTTY && !dumbTerminal && !options.ime && process.stdout.rows >= 10) {
      screen = createTerminalScreen(process.stdout, color, unicode);
    }
    const view = createTerminalView({
      writeHeader: screen?.setHeader,
      write: (text) => (screen ? screen.write(text) : process.stdout.write(text)),
      columns: () => process.stdout.columns || 80,
      color,
      unicode,
      completion: !dumbTerminal && !options.ime,
      animateProgress: Boolean(process.stdout.isTTY && !dumbTerminal && !options.ime),
    });
    view.welcome(options);
    const mouseInput = screen
      ? createTerminalInput(process.stdin, (direction) => screen?.scroll(direction, 3))
      : undefined;
    const input = mouseInput ?? process.stdin;
    const rl = createInterface({
      input,
      output: screen?.inputOutput ?? process.stdout,
      terminal: !options.ime,
      completer: (input: string) =>
        completeCommand(
          input,
          runtime.registry.getAllAdapters().map((adapter) => adapter.id),
        ),
    });
    screen?.enableMouse();
    let pasting = false;
    let busy = false;
    let closed = false;
    let turnStopped = false;
    let pendingPermission: ((allowed: boolean) => void) | undefined;
    let task: Promise<void> = Promise.resolve();
    let quota: QuotaSnapshot[] = [];
    let quotaKey = '';
    let quotaGeneration = 0;
    let refreshQuotaAfter = 0;
    const refreshQuota = async (): Promise<void> => {
      const key = options.agent + ':' + (options.model ?? '');
      if (closed || (key === quotaKey && Date.now() < refreshQuotaAfter)) return;
      if (key !== quotaKey) quota = [];
      quotaKey = key;
      refreshQuotaAfter = Date.now() + 60000;
      const generation = ++quotaGeneration;
      const adapter = runtime.registry.get(options.agent);
      if (!adapter) return;
      try {
        const snapshots = await adapter.getQuota(options.model);
        if (closed || generation !== quotaGeneration) return;
        quota = snapshots;
        screen?.refresh();
      } catch {
        // Quota can be unavailable while the agent itself still works.
      }
    };
    const quotaTimer = setInterval(() => void refreshQuota(), 60000);
    quotaTimer.unref();
    const stopProgressBeforeInput = (): void => {
      if (!screen) view.stopProgress();
    };
    input.prependListener('keypress', stopProgressBeforeInput);
    const onScreenKey = (
      text: string | undefined,
      key?: { name?: string; ctrl?: boolean; meta?: boolean },
    ): void => {
      if (key?.name === 'paste-start') pasting = true;
      if (key?.name === 'paste-end') pasting = false;
      const mode = options.inputMode;
      if (mode && mode !== 'system' && text && !pasting && !key?.ctrl && !key?.meta) {
        const composed = composeVietnamese(rl.line, rl.cursor, text, mode);
        if (composed) {
          rl.write(null, { name: 'u', ctrl: true });
          rl.write(composed.line.slice(0, composed.cursor));
        }
      }
      if (key?.name === 'pageup') screen?.scroll(1);
      else if (key?.name === 'pagedown') screen?.scroll(-1);
      else screen?.refreshInput();
    };
    if (screen) input.on('keypress', onScreenKey);
    screen?.setComposer(() => {
      const [suggestions] = completeCommand(
        rl.line,
        runtime.registry.getAllAdapters().map((agent) => agent.id),
      );
      const selection = [options.agent, options.model ?? 'mặc định', options.mode ?? 'agent'].join(
        ' · ',
      );
      const hint = pendingPermission
        ? 'Nhập y hoặc N'
        : busy
          ? 'Đang xử lý · Ctrl+C dừng'
          : suggestions.length
            ? `Tab · ${suggestions.slice(0, 3).join('  ')}`
            : '/help · Tab · PgUp/PgDn';
      return {
        draft: rl.line,
        cursor: rl.cursor,
        prompt: unicode ? '❯ ' : '> ',
        status:
          selection +
          (options.inputMode && options.inputMode !== 'system'
            ? ' · ' + options.inputMode.toUpperCase()
            : '') +
          '   ' +
          quotaLabel(options.agent, options.model, quota) +
          '   ' +
          hint,
      };
    });
    const prompt = (): void => {
      if (!closed && !busy) {
        void refreshQuota();
        syncTitle();
        if (screen) {
          screen.refresh();
          return;
        }
        view.footer(options.agent, options.model, quotaLabel(options.agent, options.model, quota));
        rl.setPrompt(view.prompt());
        rl.prompt();
      }
    };
    const askPermission = (title: string): Promise<boolean> => {
      if (closed) return Promise.resolve(false);
      view.permission(title);
      return new Promise((resolve) => {
        pendingPermission = resolve;
      });
    };
    const denyPending = (): void => {
      pendingPermission?.(false);
      pendingPermission = undefined;
    };
    const cancel = (): void => {
      denyPending();
      if (busy) {
        turnStopped = true;
        view.stopProgress();
        view.notice('Đang dừng…');
        void runtime.cancel().catch((error: Error) => view.error(error.message));
      } else rl.close();
    };
    rl.on('SIGINT', cancel);
    if (options.ime) process.on('SIGINT', cancel);
    const handle = async (input: string): Promise<void> => {
      const text = input.trim();
      if (!text) return;
      if (text === '/exit' || text === '/quit') {
        rl.close();
        return;
      }
      if (text === '/help') line(HELP);
      else if (text === '/input') view.notice('Kiểu nhập: ' + (options.inputMode ?? 'system'));
      else if (text.startsWith('/input ')) {
        const mode = parseInputMode(text.slice(7).trim());
        if (!screen && mode !== 'system')
          throw new Error('Hãy mở CodeFleet toàn màn hình để dùng bộ gõ tích hợp.');
        options.inputMode = mode;
        view.notice('Kiểu nhập: ' + mode + (mode === 'system' ? '' : ' · Chọn ENG trong Windows'));
      } else if (text === '/mode') view.notice('Chế độ: ' + (options.mode ?? 'agent'));
      else if (text.startsWith('/mode ')) {
        options.mode = parseMode(text.slice(6).trim());
        view.notice('Chế độ: ' + options.mode);
      } else if (text === '/team') view.notice('Cách dùng: /team <yêu cầu>');
      else if (text === '/agents') await showAgents();
      else if (text === '/models') await showModels();
      else if (text.startsWith('/models ')) await showModels(text.slice(8).trim());
      else if (text.startsWith('/agent ')) {
        const agent = text.slice(7).trim();
        if (agent !== 'auto') runtime.registry.getAdapter(agent);
        options.agent = agent;
        options.model = undefined;
        if (screen) view.welcome(options);
        else await refreshQuota();
        view.notice(`Agent: ${agent}`);
      } else if (text.startsWith('/model ')) {
        options.model = text.slice(7).trim();
        if (screen) view.welcome(options);
        else await refreshQuota();
        view.notice(`Model: ${options.model}`);
      } else if (text === '/history') {
        for (const conv of runtime.conversations.listByProject(runtime.projectId))
          line(`${conv.id}  ${conv.title ?? 'Hội thoại mới'}`);
      } else if (text === '/new') {
        runtime.newConversation();
        view.notice(`Hội thoại mới: ${runtime.conversationId}`);
      } else if (text === '/skill' || text === '/skills' || /^\/skills? /.test(text)) {
        await runSkillCommand(text.replace(/^\/skills?/, ''), {
          service: skills,
          currentAgent: options.agent,
          line,
          notice: view.notice,
          onChanged: () => runtime.resetSessions(),
        });
      } else if (text.startsWith('/') && !text.startsWith('/team '))
        throw new Error('Lệnh không hợp lệ. Gõ /help.');
      else {
        const oneShotTeam = text.startsWith('/team ');
        const request = oneShotTeam ? text.slice(6).trim() : text;
        const startedAt = performance.now();
        let failed = false;
        view.beginTurn();
        try {
          await runtime.send(
            request,
            {
              message: view.message,
              permission: askPermission,
              status: view.status,
            },
            oneShotTeam ? 'subagent' : options.mode,
          );
        } catch (error) {
          failed = true;
          if (!turnStopped) view.error(error instanceof Error ? error.message : String(error));
        } finally {
          view.endTurn(
            performance.now() - startedAt,
            turnStopped ? 'stopped' : failed ? 'error' : 'done',
          );
        }
      }
    };
    rl.on('line', (input: string) => {
      if (pendingPermission) {
        const resolve = pendingPermission;
        pendingPermission = undefined;
        resolve(/^(y|yes|có|co)$/i.test(input.trim()));
        view.resumeProgress();
        return;
      }
      if (busy) {
        view.notice('Đang xử lý; Ctrl+C để dừng.');
        if (!turnStopped) view.resumeProgress();
        return;
      }
      busy = true;
      turnStopped = false;
      if (input.trim()) screen?.submit(input);
      task = handle(input)
        .catch((error: Error) => view.error(error.message))
        .finally(() => {
          busy = false;
          prompt();
        });
    });
    await new Promise<void>((resolve) => {
      rl.on('close', () => {
        closed = true;
        clearInterval(quotaTimer);
        input.off('keypress', stopProgressBeforeInput);
        input.off('keypress', onScreenKey);
        if (options.ime) process.off('SIGINT', cancel);
        if (mouseInput) {
          process.stdin.unpipe(mouseInput);
          process.stdin.pause();
          mouseInput.destroy();
        }
        view.stopProgress();
        denyPending();
        void runtime.cancel().finally(resolve);
      });
      if (screen) prompt();
      else void refreshQuota().then(prompt);
    });
    await task;
  } finally {
    screen?.close();
    if (savedTitle) process.stdout.write('\x1b[23;0t');
    runtime.close();
  }
}

void main().catch((error: Error) => {
  process.stderr.write(`CodeFleet: ${terminalText(error.message)}\n`);
  if (process.exitCode !== 130) process.exitCode = 1;
});
