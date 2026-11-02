import { useEffect, useId, useRef, type ReactNode } from 'react';

export type DialogTone = 'brand' | 'warn' | 'danger';

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly tone?: DialogTone;
  readonly iconSymbol?: string;
  readonly wide?: boolean;
  readonly onClose: () => void;
  /** Cho phép MH-04 / MH-05 gắn Esc vào hành động an toàn nhất (UI_SPEC 1.1) */
  readonly onEscape?: () => void;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

const ICON_CLASSES: Record<DialogTone, string> = {
  brand: 'bg-primary-soft text-primary',
  warn: 'bg-warn-bg text-warn-ink',
  danger: 'bg-danger-bg text-danger-ink',
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  subtitle,
  tone = 'brand',
  iconSymbol,
  wide = false,
  onClose,
  onEscape,
  footer,
  children,
}: DialogProps): React.JSX.Element | null {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousActiveRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = dialogRef.current;
    if (container) {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (onEscape) {
          onEscape();
        } else {
          onClose();
        }
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !dialogRef.current.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialogRef.current.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveRef.current?.focus();
    };
  }, [open, onClose, onEscape]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-dark/40 flex items-center justify-center p-6 z-50"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          (onEscape ?? onClose)();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${
          wide ? 'w-[860px]' : 'w-[560px]'
        } max-w-full max-h-[calc(100vh-48px)] overflow-auto bg-surface rounded-dialog shadow-dialog flex flex-col`}
      >
        <div className="px-5 pt-[18px] pb-3 flex gap-3 items-start">
          {iconSymbol ? (
            <div
              aria-hidden="true"
              className={`shrink-0 w-10 h-10 rounded-card flex items-center justify-center font-bold text-[18px] ${ICON_CLASSES[tone]}`}
            >
              {iconSymbol}
            </div>
          ) : null}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h2 id={titleId} className="text-card-title font-bold text-text">
              {title}
            </h2>
            {subtitle ? <p className="text-small text-muted">{subtitle}</p> : null}
          </div>
        </div>
        <div className="px-5 pb-4 flex flex-col gap-3">{children}</div>
        {footer ? (
          <div className="px-5 py-3.5 border-t border-line flex flex-wrap gap-2.5 justify-end bg-surface-2 rounded-b-dialog">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

