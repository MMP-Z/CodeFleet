import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodeFleetBridge, ProjectRecord } from '@shared/ipc';
import { fallbackBridge } from '../../lib/bridge';
import { ProjectSelectPage } from './ProjectSelectPage';

describe('MH-02 ProjectSelectPage (Chọn / tạo dự án)', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'codefleet');
  });

  const mockProjects: ProjectRecord[] = [
    {
      id: 'proj-1',
      name: 'Tiệm Bánh Nhỏ',
      path: 'D:/Projects/tiem-banh',
      createdAt: '2026-10-30T10:00:00.000Z',
      lastOpened: '2026-11-01T20:41:00.000Z',
    },
    {
      id: 'proj-2',
      name: 'Portfolio cá nhân',
      path: 'D:/Projects/portfolio',
      createdAt: '2026-10-28T09:00:00.000Z',
      lastOpened: '2026-10-31T15:00:00.000Z',
    },
  ];

  function installMockBridge(overrides?: Partial<CodeFleetBridge>): CodeFleetBridge {
    const mockBridge: CodeFleetBridge = {
      ...fallbackBridge,
      projects: {
        list: vi.fn(async () => ({ ok: true as const, data: [...mockProjects] })),
        get: vi.fn(async (id: string) => {
          const found = mockProjects.find((p) => p.id === id) ?? null;
          return { ok: true as const, data: found };
        }),
        create: vi.fn(async (input: { name: string; path: string }) => {
          const newProj: ProjectRecord = {
            id: 'proj-new',
            name: input.name,
            path: input.path,
            createdAt: new Date().toISOString(),
            lastOpened: new Date().toISOString(),
          };
          return { ok: true as const, data: newProj };
        }),
        open: vi.fn(async (id: string) => {
          const found = mockProjects.find((p) => p.id === id) ?? mockProjects[0];
          return { ok: true as const, data: found };
        }),
        validatePath: vi.fn(async (path: string) => {
          if (path.includes('read-only')) {
            return {
              ok: true as const,
              data: {
                exists: true,
                isEmpty: false,
                isWritable: false,
                hasUserGit: false,
                errorDetail: 'EACCES: permission denied',
              },
            };
          }
          return {
            ok: true as const,
            data: {
              exists: true,
              isEmpty: true,
              isWritable: true,
              hasUserGit: false,
              errorDetail: null,
            },
          };
        }),
        pickFolder: vi.fn(async () => ({
          ok: true as const,
          data: { canceled: false, folderPath: 'D:/Projects/tiem-hoa-xinh' },
        })),
      },
      system: {
        ...fallbackBridge.system,
        getDataInfo: vi.fn(async () => ({
          ok: true as const,
          data: {
            userDataDir: 'D:/AppData/Roaming/CodeFleet',
            dbPath: 'D:/AppData/Roaming/CodeFleet/codefleet.sqlite',
            logFilePath: 'D:/AppData/Roaming/CodeFleet/logs/codefleet.log',
          },
        })),
      },
      ...overrides,
    };
    Object.defineProperty(window, 'codefleet', {
      value: mockBridge,
      writable: true,
      configurable: true,
    });
    return mockBridge;
  }

  it('renders recent projects list and filters by search query', async () => {
    installMockBridge();
    const handleSelect = vi.fn();

    render(<ProjectSelectPage onProjectSelected={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Tiệm Bánh Nhỏ')).toBeInTheDocument();
      expect(screen.getByText('Portfolio cá nhân')).toBeInTheDocument();
    });

    // Lọc tìm kiếm
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'Bánh' } });

    expect(screen.getByText('Tiệm Bánh Nhỏ')).toBeInTheDocument();
    expect(screen.queryByText('Portfolio cá nhân')).not.toBeInTheDocument();

    // Nhấp vào dự án gần đây
    fireEvent.click(screen.getByText('Tiệm Bánh Nhỏ'));
    await waitFor(() => {
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'proj-1', name: 'Tiệm Bánh Nhỏ' }),
      );
    });
  });

  it('validates project path and creates a new project', async () => {
    const bridge = installMockBridge();
    const handleSelect = vi.fn();

    render(<ProjectSelectPage onProjectSelected={handleSelect} />);

    const nameInput = screen.getByPlaceholderText('Ví dụ: Tiệm Bánh Nhỏ');
    const pathInput = screen.getByPlaceholderText('D:/du-an/tiem-banh');

    fireEvent.change(nameInput, { target: { value: 'Tiệm Hoa Xinh' } });
    fireEvent.change(pathInput, { target: { value: 'D:/Projects/tiem-hoa-xinh' } });

    // Đợi validation debounce
    await waitFor(() => {
      expect(screen.getByText('✓ Thư mục trống, có quyền ghi.')).toBeInTheDocument();
    });

    const submitBtn = screen.getByText('Tạo và bắt đầu chat →');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(bridge.projects.create).toHaveBeenCalledWith({
        name: 'Tiệm Hoa Xinh',
        path: 'D:/Projects/tiem-hoa-xinh',
      });
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tiệm Hoa Xinh', path: 'D:/Projects/tiem-hoa-xinh' }),
      );
    });
  });

  it('shows danger notice with actions when folder is not writable (Luật U2)', async () => {
    installMockBridge();
    render(<ProjectSelectPage onProjectSelected={vi.fn()} />);

    const pathInput = screen.getByPlaceholderText('D:/du-an/tiem-banh');
    fireEvent.change(pathInput, { target: { value: 'C:/Program Files/read-only' } });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Không ghi được vào “C:/Program Files/read-only”. Thư mục này cần quyền quản trị.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('Chọn thư mục trong Documents')).toBeInTheDocument();
      expect(screen.getByText('Chọn thư mục khác')).toBeInTheDocument();
    });

    // Nút tạo bị vô hiệu hoá khi quyền ghi bị từ chối
    const submitBtn = screen.getByText('Tạo và bắt đầu chat →');
    expect(submitBtn).toBeDisabled();
  });
});
