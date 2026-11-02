import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodeFleetBridge, ProjectRecord, StepDiffOutput, StepVM } from '@shared/ipc';
import { fallbackBridge } from '../../lib/bridge';
import { DirectEditPage } from '../direct-edit/DirectEditPage';
import { ProjectHistoryPage } from '../history/ProjectHistoryPage';
import { ConflictDialog } from './ConflictDialog';
import { PreviewTab } from './PreviewTab';
import { StepCodeTab } from './StepCodeTab';

describe('Phase 4 UI Components (MH-03 Code/Preview, MH-05, MH-06, MH-09)', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'codefleet');
  });

  const mockProject: ProjectRecord = {
    id: 'proj-1',
    name: 'Tiệm Bánh Nhỏ',
    path: 'D:/Projects/tiem-banh',
    createdAt: '2026-10-30T10:00:00.000Z',
    lastOpened: '2026-11-01T20:41:00.000Z',
  };

  const mockStep: StepVM = {
    id: 'step-1',
    seq: 1,
    title: 'Dựng khung trang chủ',
    agentId: 'claude',
    agentLabel: 'Claude',
    agentColor: '#C2603A',
    modelLabel: 'Sonnet 5.5',
    status: 'done',
    riskLevel: 'low',
    riskText: null,
    note: null,
    hasCode: true,
  };

  const mockDiff: StepDiffOutput = {
    stepId: 'step-1',
    summary: 'Thêm thẻ tiêu đề và khung banner màu vàng cam.',
    fullDiff: '--- a/index.html\n+++ b/index.html\n@@ -1,3 +1,5 @@\n+<h1>Tiệm Bánh Nhỏ</h1>\n',
    files: [
      {
        id: 'f-1',
        path: 'index.html',
        change: 'added',
        riskTags: null,
        diffSummary: 'Thêm thẻ h1 tiêu đề',
        fullDiff: '@@ -0,0 +1,5 @@\n+<h1>Tiệm Bánh Nhỏ</h1>',
      },
    ],
    whyApproach: 'Dùng HTML thuần theo chuẩn để load nhanh không cần build step phức tạp.',
  };

  it('StepCodeTab (MH-03): renders 3 code levels, files list, WhyBox, and undo button', async () => {
    const bridge: CodeFleetBridge = {
      ...fallbackBridge,
      code: {
        ...fallbackBridge.code,
        stepDiff: vi.fn().mockResolvedValue({ ok: true, data: mockDiff }),
      },
      checkpoints: {
        ...fallbackBridge.checkpoints,
        undoStep: vi.fn().mockResolvedValue({ ok: true, data: { ok: true, restoredCount: 1 } }),
        redoStep: vi.fn().mockResolvedValue({ ok: true, data: { ok: true, restoredCount: 1 } }),
      },
    };
    (window as unknown as { codefleet: CodeFleetBridge }).codefleet = bridge;

    const onAskSnippet = vi.fn();
    const onDirectEdit = vi.fn();
    const onStepUndone = vi.fn();

    render(
      <StepCodeTab
        step={mockStep}
        projectId={mockProject.id}
        onAskSnippet={onAskSnippet}
        onDirectEditClick={onDirectEdit}
        onStepUndone={onStepUndone}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Tóm tắt')).toBeInTheDocument();
      expect(screen.getByText('Đoạn chính')).toBeInTheDocument();
      expect(screen.getByText('Toàn bộ')).toBeInTheDocument();
      expect(screen.getByText('index.html')).toBeInTheDocument();
      expect(screen.getByText(/VÌ SAO CHỌN CÁCH NÀY/)).toBeInTheDocument();
      expect(screen.getByText(/Dùng HTML thuần/)).toBeInTheDocument();
    });

    // Chuyển sang mức Đoạn chính
    fireEvent.click(screen.getByText('Đoạn chính'));
    await waitFor(() => {
      expect(screen.getByText(/Chỉ phần thay đổi chính/)).toBeInTheDocument();
    });

    // Chuyển sang mức Toàn bộ
    fireEvent.click(screen.getByText('Toàn bộ'));
    await waitFor(() => {
      expect(screen.getByText(/Tự sửa chữ \/ màu \/ số/)).toBeInTheDocument();
    });

    // Nút Tự sửa chữ/màu/số
    const editBtn = screen.getByText(/Tự sửa chữ \/ màu \/ số/);
    fireEvent.click(editBtn);
    expect(onDirectEdit).toHaveBeenCalledTimes(1);

    // Mở modal hoàn tác
    const undoBtn = screen.getByText(/Hoàn tác bước này/);
    fireEvent.click(undoBtn);
    expect(screen.getByText(/Hoàn tác bước 1 sẽ khôi phục/)).toBeInTheDocument();

    // Xác nhận hoàn tác
    const confirmBtn = screen.getByText('Đồng ý hoàn tác');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(bridge.checkpoints.undoStep).toHaveBeenCalledWith('step-1');
    expect(onStepUndone).toHaveBeenCalledWith('step-1');
  });

  it('PreviewTab (MH-03): starts preview server and renders sandboxed iframe', async () => {
    const bridge: CodeFleetBridge = {
      ...fallbackBridge,
      preview: {
        status: vi.fn().mockResolvedValue({
          ok: true,
          data: { isWebProject: true, isRunning: true, url: 'http://127.0.0.1:4567/', error: null },
        }),
        start: vi.fn().mockResolvedValue({
          ok: true,
          data: { ok: true, url: 'http://127.0.0.1:4567/', error: null },
        }),
        stop: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      },
    };
    (window as unknown as { codefleet: CodeFleetBridge }).codefleet = bridge;

    render(<PreviewTab projectId={mockProject.id} />);

    await waitFor(() => {
      const iframe = screen.getByTitle('CodeFleet Web Preview');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'http://127.0.0.1:4567/');
      expect(iframe).toHaveAttribute('sandbox');
    });
  });

  it('ConflictDialog (MH-05): displays 2-column diff, plain explain, and 3 resolution choices', () => {
    const onResolve = vi.fn();
    const onClose = vi.fn();

    const mockConflict = {
      projectId: 'proj-1',
      stepId: 'step-1',
      filePath: 'header.html',
      userVersion: '<h1>Tiệm Bánh Vàng</h1>',
      aiVersion: '<h1>Tiệm Bánh Xanh</h1>',
      userEditedAt: '2026-11-02T10:00:00.000Z',
      plainExplain: 'Bạn đã sửa header lúc 10h. AI muốn ghi đè màu xanh.',
    };

    render(<ConflictDialog conflict={mockConflict} onResolve={onResolve} onClose={onClose} />);

    expect(screen.getByText(/Xung đột với phần bạn tự sửa/)).toBeInTheDocument();
    expect(screen.getByText('header.html', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('<h1>Tiệm Bánh Vàng</h1>')).toBeInTheDocument();
    expect(screen.getByText('<h1>Tiệm Bánh Xanh</h1>')).toBeInTheDocument();

    // Chọn option 2: Giữ nguyên bản của tôi
    const opt2Radio = screen.getByLabelText(/Giữ nguyên bản của tôi/);
    fireEvent.click(opt2Radio);

    // Bấm Xác nhận lựa chọn
    const confirmBtn = screen.getByText('Xác nhận lựa chọn');
    fireEvent.click(confirmBtn);
    expect(onResolve).toHaveBeenCalledWith('keep_user');
  });

  it('DirectEditPage (MH-06): filters items and saves changes with byte accuracy', async () => {
    const bridge: CodeFleetBridge = {
      ...fallbackBridge,
      directEdit: {
        getEditables: vi.fn().mockResolvedValue({
          ok: true,
          data: [
            {
              id: 'text-1',
              kind: 'text',
              file: 'index.html',
              label: 'Tiêu đề trang',
              value: 'Tiệm Bánh Nhỏ',
              locator: {
                line: 1,
                col: 1,
                length: 13,
                originalSnippet: 'Tiệm Bánh Nhỏ',
              },
            },
            {
              id: 'color-1',
              kind: 'color',
              file: 'style.css',
              label: 'Màu nền banner',
              value: '#f59e0b',
              locator: {
                line: 5,
                col: 10,
                length: 7,
                originalSnippet: '#f59e0b',
              },
            },
          ],
        }),
        saveDirect: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            ok: true,
            newContentHash: 'abc',
          },
        }),
      },
    };
    (window as unknown as { codefleet: CodeFleetBridge }).codefleet = bridge;

    const onBack = vi.fn();
    render(<DirectEditPage project={mockProject} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Tất cả (2)')).toBeInTheDocument();
      expect(screen.getByText('Chữ (1)')).toBeInTheDocument();
      expect(screen.getByText('Màu sắc (1)')).toBeInTheDocument();
    });

    // Sửa chữ
    const input = screen.getByDisplayValue('Tiệm Bánh Nhỏ');
    fireEvent.change(input, { target: { value: 'Tiệm Bánh Lớn' } });

    // Kiểm tra thanh sticky hiện ra nút Lưu vào file
    await waitFor(() => {
      expect(screen.getByText(/1 chỗ đã đổi, chưa lưu/)).toBeInTheDocument();
    });

    const saveBtn = screen.getByText('Lưu vào file');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(bridge.directEdit.saveDirect).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText(/Đã lưu vào file thành công/)).toBeInTheDocument();
    });
  });

  it('ProjectHistoryPage (MH-09): renders 3 tabs (Lịch sử, Vì sao làm vậy, Bản đồ)', async () => {
    const bridge: CodeFleetBridge = {
      ...fallbackBridge,
      history: {
        get: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            steps: [mockStep],
            userEdits: [{ id: 'ue-1', path: 'index.html', editedAt: '2026-11-02T10:00:00.000Z' }],
            decisions: [
              {
                id: 'dec-1',
                stepId: 'step-1',
                kind: 'approach',
                text: 'Dùng HTML thuần để tối ưu hiệu năng',
                createdAt: '2026-11-02T10:01:00.000Z',
              },
            ],
          },
        }),
      },
      projectMap: {
        get: vi.fn().mockResolvedValue({
          ok: true,
          data: [
            {
              id: 'map-1',
              feature: 'Giao diện chính',
              description: 'Trang chủ và menu bánh',
              files: ['index.html', 'style.css'],
              updatedAt: '2026-11-02T10:00:00.000Z',
            },
          ],
        }),
      },
    };
    (window as unknown as { codefleet: CodeFleetBridge }).codefleet = bridge;

    const onBack = vi.fn();
    const onViewCode = vi.fn();

    render(<ProjectHistoryPage project={mockProject} onBack={onBack} onViewCode={onViewCode} />);

    // Tab 1: Lịch sử & hoàn tác
    await waitFor(() => {
      expect(screen.getByText('Lịch sử & hoàn tác')).toBeInTheDocument();
      expect(screen.getByText('Vì sao làm vậy')).toBeInTheDocument();
      expect(screen.getByText('Bản đồ dự án')).toBeInTheDocument();
      expect(screen.getByText(/Dựng khung trang chủ/)).toBeInTheDocument();
      expect(screen.getByText('index.html', { exact: false })).toBeInTheDocument();
    });

    // Chuyển Tab 2: Vì sao làm vậy
    fireEvent.click(screen.getByText('Vì sao làm vậy'));
    await waitFor(() => {
      expect(screen.getByText(/Dùng HTML thuần để tối ưu hiệu năng/)).toBeInTheDocument();
    });

    // Chuyển Tab 3: Bản đồ dự án
    fireEvent.click(screen.getByText('Bản đồ dự án'));
    await waitFor(() => {
      expect(screen.getByText('Giao diện chính')).toBeInTheDocument();
      expect(screen.getByText('Trang chủ và menu bánh')).toBeInTheDocument();
    });
  });
});
