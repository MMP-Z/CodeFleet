import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { t } from '../i18n';
import { Button } from './Button';
import type { NoticeAction } from './Notice';

export type ToastTone = 'info' | 'ok' | 'warn' | 'danger';

export interface ToastItem {
  readonly id: string;
  readonly tone: ToastTone;
  readonly title: string;
  readonly body?: string;
  readonly actions?: readonly NoticeAction[];
}

export interface ToastProps extends ToastItem {
  readonly onDismiss: (id: string) => void;
}

const TONE_BORDER: Record<ToastTone, string> = {
  info: 'border-primary/30 bg-surface text-text',
  ok: 'border-ok-ink/25 bg-surface text-text',
  warn: 'border-warn-border bg-warn-bg text-warn-ink',
  danger: 'border-danger/40 bg-danger-bg text-danger-ink',
};

export const TOAST_AUTO_DISMISS_MS = 8000 as const;

/**
 * Toast thông báo nổi theo UI_SPEC mục 4:
 * Tự ẩn sau 8 giây, TRỪ khi tone === 'danger' (không tự ẩn).
 */
export function Toast({
  id,
  tone,
  title,
  body,
  actions,
  onDismiss,
}: ToastProps): React.JSX.Element {
  useEffect(() => {
    if (tone === 'danger') {
      return;
    }
    const timer = window.setTimeout(() => {
      onDismiss(id);
    }, TOAST_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [id, tone, onDismiss]);

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`w-[360px] max-w-[calc(100vw-32px)] border rounded-card p-3.5 shadow-pop flex flex-col gap-2 ${TONE_BORDER[tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="text-base font-semibold">{title}</strong>
        <button
          type="button"
          aria-label={t('common.dismiss')}
          onClick={() => onDismiss(id)}
          className="text-small px-1.5 py-0.5 rounded-btn border-0 bg-transparent text-current opacity-75 hover:opacity-100"
        >
          ×
        </button>
      </div>
      {body ? <p className="text-small opacity-90 break-words">{body}</p> : null}
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant ?? 'default'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastSeq = 1;

export function ToastProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<readonly ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>): string => {
    const id = `toast-${nextToastSeq++}`;
    setItems((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const contextValue = useMemo(
    () => ({ pushToast, dismissToast }),
    [pushToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {items.length > 0 ? (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 flex flex-col gap-2.5 pointer-events-auto"
        >
          {items.map((item) => (
            <Toast key={item.id} {...item} onDismiss={dismissToast} />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

