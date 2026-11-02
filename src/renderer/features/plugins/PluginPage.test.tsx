import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodeFleetBridge, PluginVM } from '@shared/ipc';
import { PluginPage } from './PluginPage';

describe('MH-10: PluginPage (UI_SPEC 5.10, PLAN 6.7, ADR-016)', () => {
  const mockPlugins: PluginVM[] = [
    {
      id: 'example.template-landing',
      name: 'Mẫu landing page',
      version: '1.0.0',
      kind: 'template',
      description: 'Trang giới thiệu một trang: banner, tính năng, bảng giá.',
      author: 'CodeFleet Team',
      permissions: ['project:write'],
      isCurated: true,
      icon: '▤',
      color: '#7A4F00',
      status: 'installed',
      checksum: 'hash1',
    },
    {
      id: 'example.skill-ecommerce-safety',
      name: 'Hướng dẫn: web bán hàng an toàn',
      version: '2.2.0',
      installedVersion: '2.1.0',
      availableVersion: '2.2.0',
      kind: 'skill-pack',
      description: 'Nhắc AI luôn kiểm tra giá ở phía máy chủ, không lưu thẻ.',
      author: 'Security Fleet',
      permissions: ['project:read'],
      isCurated: true,
      icon: '✦',
      color: '#007A55',
      status: 'update_available',
      checksum: 'hash2',
    },
    {
      id: 'example.mcp-database',
      name: 'Kết nối cơ sở dữ liệu (MCP)',
      version: '0.4.0',
      kind: 'mcp-server',
      description: 'Cho AI xem cấu trúc cơ sở dữ liệu trên máy bạn.',
      author: 'Database Community',
      permissions: ['project:read', 'process:run', 'mcp:connect'],
      isCurated: true,
      icon: 'DB',
      color: '#2563EB',
      status: 'not_installed',
      checksum: 'hash3',
    },
    {
      id: 'example.template-corrupt',
      name: 'Mẫu blog (lỗi)',
      version: '0.9.0',
      kind: 'template',
      description: 'Plugin này không mở được: file khai báo bị hỏng.',
      permissions: ['project:write'],
      isCurated: false,
      icon: '!',
      color: '#DC2626',
      status: 'corrupted',
      errorDetail: 'File khai báo hoặc checksum không hợp lệ. Đã tự động tắt.',
      checksum: 'bad',
    },
  ];

  let mockBridge: Partial<CodeFleetBridge>;

  beforeEach(() => {
    mockBridge = {
      plugins: {
        list: vi.fn().mockResolvedValue({ ok: true, data: mockPlugins }),
        install: vi.fn().mockResolvedValue({ ok: true, data: mockPlugins[2] }),
        uninstall: vi.fn().mockResolvedValue({ ok: true, data: true }),
        toggle: vi.fn().mockResolvedValue({ ok: true, data: true }),
        inspectFromUrl: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            id: 'external.my-pack',
            name: 'External Pack',
            version: '1.0.0',
            kind: 'skill-pack',
            description: 'Loaded from url',
            permissions: ['project:read'],
            entry: 'main.json',
            checksum: 'external-hash',
            isCurated: false,
            icon: '🔗',
            color: '#55625D',
          },
        }),
      },
    };

    window.codefleet = mockBridge as CodeFleetBridge;
  });

  it('renders MH-10 title, subtitle, and plugin cards', async () => {
    render(<PluginPage />);

    expect(screen.getByText('Plugin')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Mẫu landing page')).toBeInTheDocument();
      expect(screen.getByText('Hướng dẫn: web bán hàng an toàn')).toBeInTheDocument();
      expect(screen.getByText('Kết nối cơ sở dữ liệu (MCP)')).toBeInTheDocument();
      expect(screen.getByText('Mẫu blog (lỗi)')).toBeInTheDocument();
    });

    // Check badges
    expect(screen.getAllByText('✓ Đã kiểm duyệt').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Đã tắt tự động')).toBeInTheDocument();
    expect(screen.getByText('Có bản 2.2.0')).toBeInTheDocument();
  });

  it('filters plugins by search query and segmented tabs', async () => {
    render(<PluginPage />);

    await waitFor(() => {
      expect(screen.getByText('Mẫu landing page')).toBeInTheDocument();
    });

    // Search query
    const searchInput = screen.getByPlaceholderText('Tìm plugin…');
    fireEvent.change(searchInput, { target: { value: 'cơ sở dữ liệu' } });

    expect(screen.getByText('Kết nối cơ sở dữ liệu (MCP)')).toBeInTheDocument();
    expect(screen.queryByText('Mẫu landing page')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Click "Có bản mới (1)" tab
    const updatesTab = screen.getByRole('button', { name: /Có bản mới/ });
    fireEvent.click(updatesTab);

    expect(screen.getByText('Hướng dẫn: web bán hàng an toàn')).toBeInTheDocument();
    expect(screen.queryByText('Mẫu landing page')).not.toBeInTheDocument();
  });

  it('opens InstallPluginDialog with all-or-nothing permissions (ADR-016)', async () => {
    render(<PluginPage />);

    await waitFor(() => {
      expect(screen.getByText('Kết nối cơ sở dữ liệu (MCP)')).toBeInTheDocument();
    });

    // Click "Cài đặt" on mcp-database
    const installButtons = screen.getAllByRole('button', { name: 'Cài đặt' });
    fireEvent.click(installButtons[0]);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByText(/Cài “Kết nối cơ sở dữ liệu \(MCP\)”?/)).toBeInTheDocument();
      expect(
        screen.getByText(/Plugin này cần toàn bộ các quyền dưới đây để hoạt động/),
      ).toBeInTheDocument();
    });

    // Click "Đồng ý và cài đặt"
    const confirmBtn = screen.getByRole('button', { name: 'Đồng ý và cài đặt' });
    fireEvent.click(confirmBtn);

    expect(mockBridge.plugins?.install).toHaveBeenCalledWith({
      pluginId: 'example.mcp-database',
      grantedPermissions: ['project:read', 'process:run', 'mcp:connect'],
      externalManifest: undefined,
    });
  });

  it('opens InstallFromLinkDialog, enforces risk checkbox, and triggers inspect', async () => {
    render(<PluginPage />);

    // Click "＋ Cài từ đường link"
    const linkBtn = screen.getByRole('button', { name: /Cài từ đường link/ });
    fireEvent.click(linkBtn);

    expect(screen.getByText('Cài plugin từ đường link')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Tải và xem quyền' });
    expect(submitBtn).toBeDisabled();

    // Fill URL and tick checkbox
    const urlInput = screen.getByPlaceholderText('https://github.com/...');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/my-user/my-pack' } });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBridge.plugins?.inspectFromUrl).toHaveBeenCalledWith({
        url: 'https://github.com/my-user/my-pack',
      });
    });
  });
});
