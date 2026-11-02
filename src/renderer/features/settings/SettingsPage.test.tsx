import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import type { CodeFleetBridge, SettingSetInput } from '@shared/ipc';
import { DEFAULT_SETTINGS, type AppSettingsMap, type SettingKey } from '@shared/settings';
import { ToastProvider } from '../../components/Toast';
import { SettingsPage } from './SettingsPage';

describe('MH-11 SettingsPage (Chung & Dữ liệu)', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'codefleet');
  });

  function installMockBridge(overrides?: Partial<CodeFleetBridge>): CodeFleetBridge {
    let state: AppSettingsMap = { ...DEFAULT_SETTINGS };

    const mockBridge: CodeFleetBridge = {
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
      expect(screen.getByText('Mức xem code mặc định')).toBeInTheDocument();
    });
  });
});
