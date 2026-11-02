import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CodeFleetBridge,
  OrchestrationEventPayload,
  ProjectRecord,
  StepVM,
} from '@shared/ipc';
import { fallbackBridge } from '../../lib/bridge';
import { ChatPage } from './ChatPage';

describe('MH-03 ChatPage & Orchestrator UI', () => {
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

  const mockSteps: StepVM[] = [
    {
      id: 'step-1',
      seq: 1,
      title: 'Dựng khung trang chủ: tiêu đề, banner và menu',
      agentId: 'claude',
      agentLabel: 'Claude',
      agentColor: '#C2603A',
      modelLabel: 'Sonnet 5.5',
      status: 'done',
      riskLevel: 'low',
      riskText: null,
      note: null,
      hasCode: true,
    },
    {
      id: 'step-2',
      seq: 2,
      title: 'Thêm danh sách bánh có tên và giá',
      agentId: 'codex',
      agentLabel: 'Codex',
      agentColor: '#10A37F',
      modelLabel: 'GPT-5.5',
      status: 'done',
      riskLevel: 'low',
      riskText: null,
      note: null,
      hasCode: true,
    },
    {
      id: 'step-3',
      seq: 3,
      title: 'Làm giỏ hàng: thêm bánh, đổi số lượng, tính tổng tiền',
      agentId: 'codex',
      agentLabel: 'Codex',
      agentColor: '#10A37F',
      modelLabel: 'GPT-5.5',
      status: 'running',
      riskLevel: 'low',
      riskText: null,
      note: null,
      hasCode: true,
    },
    {
      id: 'step-4',
      seq: 4,
      title: 'Thêm đăng nhập bằng email và mật khẩu',
      agentId: 'claude',
      agentLabel: 'Claude',
      agentColor: '#C2603A',
      modelLabel: 'Opus 5.5',
      status: 'pending',
      riskLevel: 'high',
      riskText: 'Liên quan đăng nhập: nên đọc kỹ',
      note: 'Đổi từ Gemini Pro vì hết hạn mức',
      hasCode: false,
    },
  ];

  function installMockBridge(
    eventEmitter?: (emit: (payload: OrchestrationEventPayload) => void) => void,
  ): CodeFleetBridge {
    const mockBridge: CodeFleetBridge = {
      ...fallbackBridge,
      conversations: {
        list: vi.fn(async () => ({
          ok: true as const,
          data: [
            {
              id: 'conv-1',
              projectId: 'proj-1',
              title: 'Hội thoại ban đầu',
              createdAt: '2026-10-30T10:00:00.000Z',
              updatedAt: '2026-10-30T10:00:00.000Z',
            },
          ],
        })),
        get: vi.fn(async () => ({
          ok: true as const,
          data: {
            id: 'conv-1',
            projectId: 'proj-1',
            title: 'Hội thoại ban đầu',
            createdAt: '2026-10-30T10:00:00.000Z',
            updatedAt: '2026-10-30T10:00:00.000Z',
          },
        })),
        create: vi.fn(async () => ({
          ok: true as const,
          data: {
            id: 'conv-1',
            projectId: 'proj-1',
            title: 'Hội thoại ban đầu',
            createdAt: '2026-10-30T10:00:00.000Z',
            updatedAt: '2026-10-30T10:00:00.000Z',
          },
        })),
        messages: vi.fn(async () => ({
          ok: true as const,
          data: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              role: 'user' as const,
              content: 'Làm cho tôi trang landing đơn giản',
              createdAt: '2026-10-30T10:00:00.000Z',
            },
            {
              id: 'msg-2',
              conversationId: 'conv-1',
              role: 'assistant' as const,
              content: 'Mình chia việc thành 4 bước và tự chọn AI cho từng bước.',
              createdAt: '2026-10-30T10:00:01.000Z',
            },
          ],
        })),
        steps: vi.fn(async () => ({
          ok: true as const,
          data: [...mockSteps],
        })),
      },
      orchestrator: {
        send: vi.fn(async () => ({ ok: true as const, data: { started: true } })),
        cancel: vi.fn(async () => ({ ok: true as const, data: undefined })),
        setAiPick: vi.fn(async () => ({ ok: true as const, data: undefined })),
        onEvent: vi.fn((callback) => {
          if (eventEmitter) {
            eventEmitter(callback);
          }
          return () => {};
        }),
      },
      permission: {
        respond: vi.fn(async () => ({ ok: true as const, data: undefined })),
      },
    };

    Object.defineProperty(window, 'codefleet', {
      value: mockBridge,
      writable: true,
      configurable: true,
    });

    return mockBridge;
  }

  it('renders PlanCard with steps, progress, and step rows', async () => {
    installMockBridge();

    render(<ChatPage project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('KẾ HOẠCH')).toBeInTheDocument();
      expect(screen.getByText('2 / 4 bước xong')).toBeInTheDocument();
      expect(screen.getByText('Dựng khung trang chủ: tiêu đề, banner và menu')).toBeInTheDocument();
      expect(
        screen.getByText('Làm giỏ hàng: thêm bánh, đổi số lượng, tính tổng tiền'),
      ).toBeInTheDocument();
      expect(screen.getByText('Liên quan đăng nhập: nên đọc kỹ')).toBeInTheDocument();
      expect(screen.getByText('Đổi từ Gemini Pro vì hết hạn mức')).toBeInTheDocument();
    });
  });

  it('handles sending messages via composer', async () => {
    const bridge = installMockBridge();

    render(<ChatPage project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nhập yêu cầu tiếp theo…')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Nhập yêu cầu tiếp theo…');
    fireEvent.change(input, { target: { value: 'Thêm trang liên hệ' } });

    const sendBtn = screen.getByText('Gửi');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(bridge.orchestrator.send).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        prompt: 'Thêm trang liên hệ',
        aiPick: { type: 'auto' },
      });
    });
  });

  it('shows PermissionDialog (MH-04) and responds to permission request without "Always Allow" (Luật B5, ADR-012)', async () => {
    let triggerEvent: ((payload: OrchestrationEventPayload) => void) | null = null;
    const bridge = installMockBridge((emit) => {
      triggerEvent = emit;
    });

    render(<ChatPage project={mockProject} />);

    await waitFor(() => {
      expect(triggerEvent).not.toBeNull();
    });

    // Phát sự kiện xin phép cài thư viện
    act(() => {
      triggerEvent!({
        conversationId: 'conv-1',
        type: 'permission_requested',
        data: {
          conversationId: 'conv-1',
          requestId: 'req-1',
          stepSeq: 4,
          agentLabel: 'Claude',
          modelLabel: 'Opus 5.5',
          actionTitle: 'cài thêm một thư viện',
          description:
            'Để làm phần đăng nhập, AI muốn tải về và cài bcrypt giúp cất mật khẩu an toàn.',
          impactSummary: {
            network: 'Tải thư viện từ kho npm trên Internet.',
            command: 'Chạy lệnh cài trong thư mục dự án Documents/tiem-banh.',
            file: 'Thêm 1 dòng vào package.json.',
          },
          exactCommand: 'npm install bcrypt',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('AI muốn cài thêm một thư viện')).toBeInTheDocument();
      expect(screen.getByText('Claude · Opus 5.5 · Bước 4', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Cho phép lần này')).toBeInTheDocument();
      expect(screen.getByText('Không cho phép')).toBeInTheDocument();
    });

    // Khẳng định KHÔNG CÓ "Luôn cho phép" (Luật B5 / ADR-012)
    expect(screen.queryByText(/luôn cho phép/i)).not.toBeInTheDocument();

    // Nhấp "Cho phép lần này"
    fireEvent.click(screen.getByText('Cho phép lần này'));
    await waitFor(() => {
      expect(bridge.permission.respond).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        requestId: 'req-1',
        allowed: true,
      });
    });
  });

  it('shows PausedCard (MH-07) when rate limit occurs and step is high risk (Luật PLAN 4.5a)', async () => {
    let triggerEvent: ((payload: OrchestrationEventPayload) => void) | null = null;
    const bridge = installMockBridge((emit) => {
      triggerEvent = emit;
    });

    render(<ChatPage project={mockProject} />);

    await waitFor(() => {
      expect(triggerEvent).not.toBeNull();
    });

    // Phát sự kiện tạm dừng vì rate limit
    act(() => {
      triggerEvent!({
        conversationId: 'conv-1',
        type: 'execution_paused',
        data: {
          stepSeq: 4,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('⏸ Tạm dừng: chưa có AI đủ mạnh cho bước 4')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Bước 4 làm phần nhạy cảm nên app không tự hạ xuống model nhanh. File của bạn đã được khôi phục về lúc đầu bước 4, không có gì dở dang.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('↻ Thử lại bước này')).toBeInTheDocument();
    });

    // Nhấp "↻ Thử lại bước này"
    fireEvent.click(screen.getByText('↻ Thử lại bước này'));
    await waitFor(() => {
      expect(bridge.orchestrator.send).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          prompt: 'Thử lại bước đang tạm dừng',
        }),
      );
    });
  });
});
