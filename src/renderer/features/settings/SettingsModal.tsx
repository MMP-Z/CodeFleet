import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { t } from '../../i18n';
import { SettingsPage } from './SettingsPage';

export interface SettingsModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Hộp thoại Cài đặt chung (Settings Dialog) mở đè lên giao diện hiện tại theo yêu cầu người dùng.
 * Cho phép chỉnh sửa cấu hình Chung, AI & Model, Cập nhật và Dữ liệu mà không bị đổi trang.
 */
export function SettingsModal({ open, onClose }: SettingsModalProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      title={t('mh11.title')}
      subtitle="Quản lý cấu hình chung, mô hình AI, cập nhật ứng dụng và dữ liệu"
      iconSymbol="⚙"
      extraWide
      showCloseButton
      onClose={onClose}
      onEscape={onClose}
      footer={
        <Button variant="default" onClick={onClose}>
          {t('common.close') || 'Đóng'}
        </Button>
      }
    >
      <div className="py-1">
        <SettingsPage isModal onClose={onClose} />
      </div>
    </Dialog>
  );
}
