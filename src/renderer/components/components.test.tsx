import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APP_NAME } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import { AppHeader } from './AppHeader';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Notice, type NoticeAction } from './Notice';
import { truncateMiddlePath } from './ProjectPill';
import { Segmented } from './Segmented';
import { Toast, TOAST_AUTO_DISMISS_MS } from './Toast';
import { Toggle } from './Toggle';

describe('Phase 1 UI Primitives (UI_SPEC 1.1, 2, 4, Luật U2, P6)', () => {
  it('renders AppHeader with APP_NAME constant and respects featureFlags.devComponents (Luật P6)', () => {
    const onNavigate = vi.fn();
    const prodFlags = resolveFeatureFlags(false);

    const { rerender } = render(
      <AppHeader activeNav="settings" onNavigate={onNavigate} featureFlags={prodFlags} />,
    );

    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cài đặt' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('button', { name: /Dev/i })).not.toBeInTheDocument();

    const devFlags = resolveFeatureFlags(true);
    rerender(<AppHeader activeNav="settings" onNavigate={onNavigate} featureFlags={devFlags} />);
    expect(screen.getByRole('button', { name: /Dev/i })).toBeInTheDocument();
  });

  it('implements accessible Toggle (role="switch" + aria-checked) and Segmented (aria-pressed)', () => {
    const onToggle = vi.fn();
    const onSeg = vi.fn();

    render(
      <div>
        <Toggle checked={false} onChange={onToggle} ariaLabel="Hiện thuật ngữ" />
        <Segmented
          ariaLabel="Mức xem code"
          value="summary"
          onChange={onSeg}
          options={[
            { value: 'summary', label: 'Tóm tắt' },
            { value: 'diff', label: 'Đoạn chính' },
          ]}
        />
      </div>,
    );

    const sw = screen.getByRole('switch', { name: 'Hiện thuật ngữ' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalledWith(true);

    const summaryBtn = screen.getByRole('button', { name: 'Tóm tắt' });
    const diffBtn = screen.getByRole('button', { name: 'Đoạn chính' });
    expect(summaryBtn).toHaveAttribute('aria-pressed', 'true');
    expect(diffBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(diffBtn);
    expect(onSeg).toHaveBeenCalledWith('diff');
  });

  it('enforces >=1 action button on danger Notice per Luật U2 / G2', () => {
    const onRetry = vi.fn();
    render(
      <Notice tone="danger" actions={[{ label: 'Thử lại', onClick: onRetry }]}>
        Lỗi đọc dữ liệu
      </Notice>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Kiểm tra runtime guard khi cố tình truyền mảng rỗng qua ép kiểu
    const emptyActions = [] as unknown as readonly [NoticeAction, ...NoticeAction[]];
    expect(() =>
      render(
        <Notice tone="danger" actions={emptyActions}>
          Lỗi cụt
        </Notice>,
      ),
    ).toThrow(/Luật U2/);
  });

  it('traps Tab focus inside Dialog and handles Escape key (UI_SPEC 1.1)', () => {
    const onClose = vi.fn();
    render(
      <Dialog
        open={true}
        title="Hộp thoại thử"
        onClose={onClose}
        footer={
          <>
            <Button>Nút 1</Button>
            <Button variant="primary">Nút 2</Button>
          </>
        }
      >
        <p>Nội dung hộp thoại</p>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Hộp thoại thử' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const btn1 = screen.getByRole('button', { name: 'Nút 1' });
    const btn2 = screen.getByRole('button', { name: 'Nút 2' });
    expect(document.activeElement).toBe(btn1);

    btn2.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(btn1);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(btn2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses non-danger Toast after 8s but keeps danger Toast open (UI_SPEC 4)', () => {
    vi.useFakeTimers();
    const onDismissInfo = vi.fn();
    const onDismissDanger = vi.fn();

    render(
      <div>
        <Toast id="t-info" tone="info" title="Thông tin" onDismiss={onDismissInfo} />
        <Toast id="t-danger" tone="danger" title="Lỗi nghiêm trọng" onDismiss={onDismissDanger} />
      </div>,
    );

    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS + 100);
    });

    expect(onDismissInfo).toHaveBeenCalledWith('t-info');
    expect(onDismissDanger).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('truncates long project paths in the middle cleanly', () => {
    const short = truncateMiddlePath('Documents/tiem-banh');
    expect(short).toBe('Documents/tiem-banh');

    const long = truncateMiddlePath(
      'C:\\Users\\HOANG VIET\\Documents\\VeryLongWorkspaceFolder\\Projects\\tiem-banh-nho',
    );
    expect(long).toContain('…');
    expect(long.endsWith('tiem-banh-nho')).toBe(true);
  });
});

