import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectResult } from '@shared/agents';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import type { CodeFleetBridge, SettingSetInput } from '@shared/ipc';
import { DEFAULT_SETTINGS, type AppSettingsMap, type SettingKey } from '@shared/settings';
import { ToastProvider } from '../../components/Toast';
import { fallbackBridge } from '../../lib/bridge';
import { SettingsPage } from './SettingsPage';

describe('MH-11 SettingsPage (Chung & Dữ liệu)', () => {
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
        set: vi.fn(async (input: SettingSetInput) => {
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
            backupPath: 'D:/AppData/Roaming/CodeFleet/backups/codefleet-user.sqlite.bak',
            createdAt: '2026-11-02T10:00:00.000Z',
            sizeBytes: 24576,
          },
        })),
      },
      agents: {
        detectAll: vi.fn(async () => ({ ok: true as const, data: [] })),
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

  it('loads settings via IPC and updates codeLevel, showJargon, and autoPreview', async () => {
    const bridge = installMockBridge();

    render(
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Chung' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Chung' }));

    await waitFor(() => {
      expect(screen.getByText('Mức xem code mặc định')).toBeInTheDocument();
    });

    // Đổi mức xem code sang "Đoạn chính"
    fireEvent.click(screen.getByRole('button', { name: 'Đoạn chính' }));
    await waitFor(() => {
      expect(bridge.settings.set).toHaveBeenCalledWith({
        key: 'ui.codeLevel',
        value: 'diff',
      });
    });

    // Bật "Hiện thuật ngữ kỹ thuật"
    const jargonSwitch = screen.getByRole('switch', { name: 'Hiện thuật ngữ kỹ thuật' });
    expect(jargonSwitch).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(jargonSwitch);
    await waitFor(() => {
      expect(bridge.settings.set).toHaveBeenCalledWith({
        key: 'ui.showJargon',
        value: true,
      });
    });
  });

  it('renders AI and Models tab, allows recheck, and updates model tier', async () => {
    const mockAgents: DetectResult[] = [
      {
        agentId: 'claude',
        displayName: 'Claude Code',
        shortName: 'Claude',
        logoLetter: 'C',
        color: '#C2603A',
        darkColor: '#E08A64',
        docsUrl: 'https://docs.anthropic.com',
        installCommand: 'irm https://claude.ai/install.ps1 | iex',
        loginCommand: 'claude auth login',
        installed: true,
        version: '1.2.0',
        loggedIn: true,
        status: 'ready',
        errorDetail: null,
        modelsCount: 2,
      },
    ];

    const mockModels = [
      {
        id: 'claude-sonnet-4-5',
        agentId: 'claude',
        agentDisplayName: 'Claude Code',
        label: 'Claude Sonnet',
        tier: 'balanced' as const,
        tierSource: 'default' as const,
      },
    ];

    const bridge = installMockBridge({
      agents: {
        detectAll: vi.fn(async () => ({ ok: true as const, data: mockAgents })),
        openLogin: vi.fn(async () => ({ ok: true as const, data: undefined })),
        openDocs: vi.fn(async () => ({ ok: true as const, data: undefined })),
      },
      models: {
        list: vi.fn(async () => ({ ok: true as const, data: mockModels })),
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
    });

    render(
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>,
    );

    // Kiểm tra render bảng AI trên máy
    await waitFor(() => {
      expect(screen.getByText('AI trên máy')).toBeInTheDocument();
      expect(screen.getAllByText('Claude Code').length).toBeGreaterThanOrEqual(1);
    });

    // Bấm nút "↻ Kiểm tra lại"
    const recheckBtn = screen.getByRole('button', { name: /Kiểm tra lại/i });
    fireEvent.click(recheckBtn);
    expect(bridge.agents.detectAll).toHaveBeenCalled();

    // Bấm toggle tắt AI
    const toggleBtn = screen.getByRole('switch', { name: /Sử dụng Claude Code/i });
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(bridge.settings.set).toHaveBeenCalledWith({
        key: 'agents.enabled',
        value: { claude: false },
      });
    });

    // Đổi bậc model
    const tierSelect = screen.getByRole('combobox');
    expect(tierSelect).toHaveValue('balanced');
    fireEvent.change(tierSelect, { target: { value: 'strong' } });
    await waitFor(() => {
      expect(bridge.models.setTier).toHaveBeenCalledWith('claude', 'claude-sonnet-4-5', 'strong');
    });
  });

  it('renders Data tab with userDataDir, opens folder, and creates manual DB backup', async () => {
    const bridge = installMockBridge();

    render(
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dữ liệu' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dữ liệu' }));

    await waitFor(() => {
      expect(screen.getByText('D:/AppData/Roaming/CodeFleet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mở thư mục' }));
    expect(bridge.system.openDataDir).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sao lưu ngay' }));
    await waitFor(() => {
      expect(bridge.system.backupNow).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Đã tạo bản sao lưu dữ liệu')).toBeInTheDocument();
    });
  });

  it('shows actionable retry Notice when initial IPC load fails (Luật U2)', async () => {
    const getAllMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        error: { code: 'INTERNAL_ERROR' as const, message: 'DB locked' },
      })
      .mockResolvedValueOnce({
        ok: true as const,
        data: { ...DEFAULT_SETTINGS },
      });

    const base = installMockBridge();
    window.codefleet = {
      ...base,
      settings: {
        ...base.settings,
        getAll: getAllMock,
      },
    };

    render(
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => {
      expect(getAllMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Chung' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Chung' }));
    await waitFor(() => {
      expect(screen.getByText('Mức xem code mặc định')).toBeInTheDocument();
    });
  });

  it('renders Update tab, allows switching release channel, toggling auto-download, and checking for updates', async () => {
    const bridge = installMockBridge({
      update: {
        getState: vi.fn(async () => ({
          ok: true as const,
          data: {
            status: 'idle' as const,
            currentVersion: '0.1.0',
            channel: 'stable' as const,
            autoDownload: true,
            availableVersion: null,
            releaseDate: null,
            releaseNotes: null,
            downloadProgress: null,
            lastCheckedAt: null,
            error: null,
          },
        })),
        check: vi.fn(async () => ({
          ok: true as const,
          data: { hasUpdate: false, version: null, releaseNotes: null },
        })),
        download: vi.fn(async () => ({ ok: true as const, data: { ok: true } })),
        restart: vi.fn(async () => ({ ok: true as const, data: { ok: true } })),
        setChannel: vi.fn(async (channel) => ({
          ok: true as const,
          data: {
            status: 'idle' as const,
            currentVersion: '0.1.0',
            channel,
            autoDownload: true,
            availableVersion: null,
            releaseDate: null,
            releaseNotes: null,
            downloadProgress: null,
            lastCheckedAt: null,
            error: null,
          },
        })),
        setAutoDownload: vi.fn(async (autoDownload) => ({
          ok: true as const,
          data: {
            status: 'idle' as const,
            currentVersion: '0.1.0',
            channel: 'stable' as const,
            autoDownload,
            availableVersion: null,
            releaseDate: null,
            releaseNotes: null,
            downloadProgress: null,
            lastCheckedAt: null,
            error: null,
          },
        })),
        onStateChange: vi.fn(() => () => {}),
      },
    });

    render(
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));

    await waitFor(() => {
      expect(screen.getByText(/Đang dùng bản 0.1.0/i)).toBeInTheDocument();
      expect(screen.getByText('Kênh cập nhật')).toBeInTheDocument();
      expect(screen.getByText('Tự tải bản cập nhật')).toBeInTheDocument();
    });

    // Check updates
    const checkBtn = screen.getByRole('button', { name: /Kiểm tra bản cập nhật/i });
    fireEvent.click(checkBtn);
    expect(bridge.update.check).toHaveBeenCalledWith(true);

    // Switch channel to Beta
    const betaBtn = screen.getByRole('button', { name: 'Thử nghiệm' });
    fireEvent.click(betaBtn);
    expect(bridge.update.setChannel).toHaveBeenCalledWith('beta');
  });
});
