import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';

export type NoticeTone = 'info' | 'warn' | 'danger' | 'neutral';

export interface NoticeAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant?: ButtonVariant;
}

interface BaseNoticeProps {
  readonly children: ReactNode;
  readonly small?: boolean;
  readonly className?: string;
}

export type NoticeProps =
  | (BaseNoticeProps & {
      readonly tone: 'danger';
      /** Luật U2 / G2: Thông báo lỗi (danger) bắt buộc có ít nhất 1 nút hành động tiếp theo */
      readonly actions: readonly [NoticeAction, ...NoticeAction[]];
    })
  | (BaseNoticeProps & {
      readonly tone: 'info' | 'warn' | 'neutral';
      readonly actions?: readonly NoticeAction[];
    });

const TONE_CONTAINER: Record<NoticeTone, string> = {
  info: 'bg-primary-soft text-primary-ink',
  warn: 'bg-warn-bg text-warn-ink',
  danger: 'bg-danger-bg text-danger-ink',
  neutral: 'bg-bg text-muted',
};

const TONE_ICON: Record<NoticeTone, string> = {
  info: 'i',
  warn: '!',
  danger: '!',
  neutral: 'i',
};

export function Notice(props: NoticeProps): React.JSX.Element {
  const { tone, children, small = false, className = '', actions } = props;

  if (tone === 'danger' && (!actions || actions.length === 0)) {
    throw new Error(
      'Vi phạm Luật U2 (UI_SPEC G2): Notice tone="danger" bắt buộc có ít nhất 1 action.',
    );
  }

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`px-3.5 py-2.5 rounded-input flex gap-2.5 items-start ${TONE_CONTAINER[tone]} ${
        small ? 'text-small' : 'text-base'
      } ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="shrink-0 font-bold w-5 h-5 rounded-pill flex items-center justify-center text-small bg-dark/10"
      >
        {TONE_ICON[tone]}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div>{children}</div>
        {actions && actions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant ?? (tone === 'danger' ? 'danger' : 'default')}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
