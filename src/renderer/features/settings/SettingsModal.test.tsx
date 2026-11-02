import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { resolveFeatureFlags } from '@shared/feature-flags';
import type { CodeFleetBridge } from '@shared/ipc';
import { ToastProvider } from '../../components/Toast';
import { fallbackBridge } from '../../lib/bridge';
import { SettingsModal } from './SettingsModal';

describe('SettingsModal (Hộp thoại cài đặt chung)', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'codefleet');
  });

  function installMockBridge(): CodeFleetBridge {
    const mockBridge: CodeFleetBridge = {
      ...fallbackBridge,
      appName: APP_NAME,
      appVersion: APP_VERSION,
      featureFlags: resolveFeatureFlags(false),
    };
    (window as unknown as { codefleet: CodeFleetBridge }).codefleet = mockBridge;
    return mockBridge;
  }

  it('không hiển thị khi open=false', () => {
    installMockBridge();
    render(
      <ToastProvider>
        <SettingsModal open={false} onClose={vi.fn()} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hiển thị hộp thoại khi open=true và đóng khi bấm Đóng hoặc phím Escape', () => {
    installMockBridge();
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <SettingsModal open={true} onClose={onClose} />
      </ToastProvider>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Cài đặt' });
    expect(dialog).toBeInTheDocument();

    // Bấm nút Đóng
    const closeButtons = screen.getAllByRole('button', { name: 'Đóng' });
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0]!);
    expect(onClose).toHaveBeenCalled();

    // Phím Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
