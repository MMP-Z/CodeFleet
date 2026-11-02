import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectResult, ModelInfo, QuotaSnapshot } from '@shared/ipc';
import { QuotaDetailsPage } from './QuotaDetailsPage';

describe('MH-08: QuotaDetailsPage (UI_SPEC 5.8, PLAN 6.6, ADR-018)', () => {
  const mockSnapshots: QuotaSnapshot[] = [
    {
      id: 'snap-claude',
      agentId: 'claude',
      model: null,
      scope: 'shared',
      plan: 'Claude Pro',
      windows: [
        { label: 'Cửa sổ 5 giờ', usedPercent: 62, resetsAt: '2026-11-02T22:40:00Z' },
        { label: 'Tuần', usedPercent: 38, resetsAt: null },
      ],
      status: 'ok',
      source: 'official',
      capturedAt: '2026-11-02T20:41:00Z',
    },
    {
      id: 'snap-codex',
      agentId: 'codex',
      model: null,
      scope: 'shared',
      plan: 'ChatGPT Plus',
      windows: [
        { label: 'Cửa sổ 5 giờ', usedPercent: 81, resetsAt: '2026-11-02T23:15:00Z' },
        { label: 'Tuần', usedPercent: 54, resetsAt: null },
      ],
      status: 'low',
      source: 'estimated',
      capturedAt: '2026-11-02T20:41:00Z',
    },
    {
      id: 'snap-copilot-sonnet',
      agentId: 'copilot',
      model: 'claude-3.5-sonnet',
      scope: 'model',
      plan: 'GitHub Copilot',
      windows: [{ label: 'Hôm nay', usedPercent: 100, resetsAt: '2026-11-03T00:00:00Z' }],
      status: 'exhausted',
      source: 'detected',
      capturedAt: '2026-11-02T20:41:00Z',
    },
    {
      id: 'snap-copilot-gpt4o',
      agentId: 'copilot',
      model: 'gpt-4o',
      scope: 'model',
      plan: 'GitHub Copilot',
      windows: [{ label: 'Hôm nay', usedPercent: 23, resetsAt: '2026-11-03T00:00:00Z' }],
      status: 'ok',
      source: 'estimated',
      capturedAt: '2026-11-02T20:41:00Z',
    },
  ];

  const mockAgents: DetectResult[] = [
    {
      agentId: 'claude',
      displayName: 'Claude',
      shortName: 'Claude',
      logoLetter: 'C',
      color: '#D97706',
      darkColor: '#B45309',
      docsUrl: 'https://docs.anthropic.com',
      installed: true,
      loggedIn: true,
      status: 'ready',
      version: '1.0.0',
      installCommand: 'npm i -g @anthropic-ai/claude-code',
      loginCommand: 'claude login',
      errorDetail: null,
      modelsCount: 1,
    },
    {
      agentId: 'codex',
      displayName: 'Codex',
      shortName: 'Codex',
      logoLetter: 'O',
      color: '#10A37F',
      darkColor: '#047857',
      docsUrl: 'https://platform.openai.com',
      installed: true,
      loggedIn: true,
      status: 'ready',
      version: '1.0.0',
      installCommand: 'npm i -g @openai/codex',
      loginCommand: 'codex login',
      errorDetail: null,
      modelsCount: 1,
    },
    {
      agentId: 'copilot',
      displayName: 'Copilot',
      shortName: 'Copilot',
      logoLetter: 'P',
      color: '#2563EB',
      darkColor: '#1D4ED8',
      docsUrl: 'https://docs.github.com',
      installed: true,
      loggedIn: true,
      status: 'ready',
      version: '1.0.0',
      installCommand: 'winget install GitHub.cli',
      loginCommand: 'gh auth login',
      errorDetail: null,
      modelsCount: 2,
    },
  ];

  const mockModels: Record<string, ModelInfo[]> = {
    claude: [
      {
        id: 'claude-3-5-sonnet-20241022',
        agentId: 'claude',
        agentDisplayName: 'Claude',
        label: 'Sonnet 3.5',
        tier: 'balanced',
        tierSource: 'default',
      },
    ],
    codex: [
      {
        id: 'gpt-4o',
        agentId: 'codex',
        agentDisplayName: 'Codex',
        label: 'GPT-4o',
        tier: 'strong',
        tierSource: 'default',
      },
    ],
    copilot: [
      {
        id: 'claude-3.5-sonnet',
        agentId: 'copilot',
        agentDisplayName: 'Copilot',
        label: 'Claude 3.5 Sonnet',
        tier: 'strong',
        tierSource: 'default',
      },
      {
        id: 'gpt-4o',
        agentId: 'copilot',
        agentDisplayName: 'Copilot',
        label: 'GPT-4o',
        tier: 'fast',
        tierSource: 'default',
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('codefleet', {
      quota: {
        getAll: vi.fn().mockResolvedValue({ ok: true, data: mockSnapshots }),
        refresh: vi.fn().mockResolvedValue({ ok: true, data: mockSnapshots }),
        onUpdate: vi.fn().mockReturnValue(() => {}),
      },
      agents: {
        detectAll: vi.fn().mockResolvedValue({ ok: true, data: mockAgents }),
      },
      models: {
        list: vi
          .fn()
          .mockImplementation((agentId: string) =>
            Promise.resolve({ ok: true, data: mockModels[agentId] ?? [] }),
          ),
      },
    });
  });

  it('renders MH-08 title, accuracy notice, and CLI cards', async () => {
    render(<QuotaDetailsPage />);

    expect(screen.getByText('Hạn mức của các AI')).toBeInTheDocument();
    expect(screen.getByText('Độ tin cậy của con số:')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Codex')).toBeInTheDocument();
      expect(screen.getByText('Copilot')).toBeInTheDocument();
    });

    // Kiểm tra thông tin 4 ý nguyên tắc chọn AI
    expect(screen.getByText('App dùng hạn mức thế nào khi chọn AI')).toBeInTheDocument();
    expect(screen.getByText('Đọc hạn mức không tốn hạn mức của bạn.')).toBeInTheDocument();
  });

  it('handles passive refresh button click without prompt invocation (ADR-018)', async () => {
    const refreshSpy = vi.fn().mockResolvedValue({ ok: true, data: mockSnapshots });
    const bridge = (window as unknown as { codefleet: { quota: { refresh: typeof refreshSpy } } })
      .codefleet;
    bridge.quota.refresh = refreshSpy;

    render(<QuotaDetailsPage />);

    const refreshBtn = screen.getByRole('button', { name: /↻ Làm mới/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates to settings when link is clicked', async () => {
    const onNavigateToSettings = vi.fn();
    render(<QuotaDetailsPage onNavigateToSettings={onNavigateToSettings} />);

    await waitFor(() => {
      expect(screen.getByText('Claude')).toBeInTheDocument();
    });

    const link = screen.getByText('Đổi ngưỡng cảnh báo và thông báo trong Cài đặt →');
    fireEvent.click(link);
    expect(onNavigateToSettings).toHaveBeenCalledTimes(1);
  });
});
