import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectResult } from '@shared/agents';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import type { CodeFleetBridge } from '@shared/ipc';
import { DEFAULT_SETTINGS, type AppSettingsMap, type SettingKey } from '@shared/settings';
import { ToastProvider } from '../../components/Toast';
import { fallbackBridge } from '../../lib/bridge';
import { OnboardingPage } from './OnboardingPage';

const mockDetectedAgents: DetectResult[] = [
  {
    agentId: 'claude',
    displayName: 'Claude Code',
    shortName: 'Claude',
    logoLetter: 'C',
    color: '#C2603A',
    darkColor: '#E08A64',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    installCommand: 'irm https://claude.ai/install.ps1 | iex',
    loginCommand: 'claude auth login',
    installed: true,
    version: '1.2.0',
    loggedIn: true,
    status: 'ready',
    errorDetail: null,
    modelsCount: 3,
  },
  {
    agentId: 'codex',
    displayName: 'Codex CLI',
    shortName: 'Codex',
    logoLetter: 'X',
    color: '#2F5FD0',
    darkColor: '#6F9BFF',
    docsUrl: 'https://developers.openai.com/codex/cli',
    installCommand: 'npm install -g @openai/codex',
    loginCommand: 'codex login',
    installed: true,
    version: '0.9.1',
    loggedIn: false,
    status: 'not_logged_in',
    errorDetail: null,
    modelsCount: 2,
  },
  {
    agentId: 'copilot',
    displayName: 'Copilot CLI',
    shortName: 'Copilot',
    logoLetter: 'P',
    color: '#0969DA',
    darkColor: '#58A6FF',
    docsUrl: 'https://docs.github.com/en/copilot/github-copilot-in-the-cli',
    installCommand: 'winget install GitHub.cli',
    loginCommand: 'gh auth login',
    installed: false,
    version: null,
    loggedIn: false,
    status: 'not_installed',
    errorDetail: null,
    modelsCount: 0,
  },
];

describe('MH-01 OnboardingPage (Khởi động lần đầu)', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'codefleet');
  });

  function installMockBridge(overrides?: Partial<CodeFleetBridge>): CodeFleetBridge {
    let state: AppSettingsMap = { ...DEFAULT_SETTINGS };

    const mockBridge: CodeFleetBridge = {
      ...fallbackBridge,
      appName: APP_NAME,
      appVersion: APP_VERSION,
      featureFlags: resolveFeatureFlags(false),
      settings: {
        get: vi.fn(async <K extends SettingKey>(key: K) => ({
          ok: true as const,
          data: state[key],
        })),
        getAll: vi.fn(async () => ({ ok: true as const, data: { ...state } })),
        set: vi.fn(async (input) => {
          state = { ...state, [input.key]: input.value };
          return { ok: true as const, data: { ...state } };
        }),
      },
      system: {
        checkGit: vi.fn(async () => ({
          ok: true as const,
          data: { available: true, version: '2.42.0' },
        })),
        getDataInfo: vi.fn(async () => ({
          ok: true as const,
          data: {
            userDataDir: 'D:/AppData/Roaming/CodeFleet',
            dbPath: 'D:/AppData/Roaming/CodeFleet/codefleet.sqlite',
            logFilePath: 'D:/AppData/Roaming/CodeFleet/logs/codefleet.log',
          },
        })),
        openDataDir: vi.fn(async () => ({
          ok: true as const,
          data: { opened: true, error: null },
        })),
        backupNow: vi.fn(async () => ({
          ok: true as const,
          data: {
            backupPath: 'D:/AppData/Roaming/CodeFleet/backups/test.bak',
            createdAt: '2026-11-02T10:00:00.000Z',
            sizeBytes: 1024,
          },
        })),
      },
      agents: {
        detectAll: vi.fn(async () => ({ ok: true as const, data: mockDetectedAgents })),
        openLogin: vi.fn(async () => ({ ok: true as const, data: undefined })),
        openDocs: vi.fn(async () => ({ ok: true as const, data: undefined })),
      },
      models: {
        list: vi.fn(async () => ({ ok: true as const, data: [] })),
        setTier: vi.fn(async (_agentId, modelId, tier) => ({
          ok: true as const,
          data: {
            id: modelId,
            agentId: 'claude',
            agentDisplayName: 'Claude Code',
            label: modelId,
            tier,
            tierSource: 'user' as const,
          },
        })),
      },
      ...overrides,
    };

    window.codefleet = mockBridge;
    return mockBridge;
  }

  it('renders stepper, detected agents list, and enables continue button when at least 1 CLI is ready', async () => {
    const bridge = installMockBridge();
    const onCompleted = vi.fn();

    render(
      <ToastProvider>
        <OnboardingPage onCompleted={onCompleted} />
      </ToastProvider>,
    );

    // Bước 1: Chào mừng
    expect(screen.getByText('Chào mừng bạn đến với CodeFleet')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /Bắt đầu kiểm tra AI/i });
    fireEvent.click(startBtn);

    // Bước 2: Tiêu đề kiểm tra
    expect(screen.getByText('Kiểm tra các AI trên máy bạn')).toBeInTheDocument();

    // Chờ detectAll tải xong
    await waitFor(() => {
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
      expect(screen.getByText('Codex CLI')).toBeInTheDocument();
      expect(screen.getByText('Copilot CLI')).toBeInTheDocument();
    });

    // Pill trạng thái
    expect(screen.getByText('✓ Sẵn sàng')).toBeInTheDocument();
    expect(screen.getByText('Chưa đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Chưa cài')).toBeInTheDocument();

    // Nút Tiếp tục: vì chỉ có 1 CLI ready (Claude) nên nút ghi "Tiếp tục với Claude →"
    const continueBtn = screen.getByRole('button', { name: /Tiếp tục với Claude/i });
    expect(continueBtn).toBeEnabled();

    // Bấm Tiếp tục sang Bước 3 (Sẵn sàng)
    fireEvent.click(continueBtn);
    expect(screen.getByText('Đội tàu AI đã sẵn sàng!')).toBeInTheDocument();

    const finishBtn = screen.getByRole('button', { name: /Vào chọn dự án và bắt đầu chat/i });
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(bridge.settings.set).toHaveBeenCalledWith({
        key: 'onboarding.completed',
        value: true,
      });
      expect(onCompleted).toHaveBeenCalled();
    });
  });

  it('calls openLogin when user clicks "Mở cửa sổ đăng nhập" (Luật B3)', async () => {
    const bridge = installMockBridge();

    render(
      <ToastProvider>
        <OnboardingPage initialStep={2} />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Codex CLI')).toBeInTheDocument();
    });

    const openLoginBtn = screen.getByRole('button', { name: 'Mở cửa sổ đăng nhập' });
    fireEvent.click(openLoginBtn);

    expect(bridge.agents.openLogin).toHaveBeenCalledWith('codex');
  });

  it('calls openDocs when user clicks "Mở trang hướng dẫn ↗"', async () => {
    const bridge = installMockBridge();

    render(
      <ToastProvider>
        <OnboardingPage initialStep={2} />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Copilot CLI')).toBeInTheDocument();
    });

    const openDocsBtn = screen.getByRole('button', { name: 'Mở trang hướng dẫn ↗' });
    fireEvent.click(openDocsBtn);

    expect(bridge.agents.openDocs).toHaveBeenCalledWith('copilot');
  });
});
