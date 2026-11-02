import type { HTMLAttributes, ReactNode } from 'react';

export type PillTone = 'ok' | 'run' | 'wait' | 'warn' | 'danger' | 'brand';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: PillTone;
  readonly children: ReactNode;
}

const TONE_CLASSES: Record<PillTone, string> = {
  ok: 'bg-ok-bg text-ok-ink',
  run: 'bg-info-bg text-info-ink',
  wait: 'bg-line text-muted',
  warn: 'bg-warn-bg text-warn-ink',
  danger: 'bg-danger-bg text-danger-ink',
  brand: 'bg-primary-soft text-primary-ink',
};

export function Pill({
  tone = 'wait',
  className = '',
  children,
  ...rest
}: PillProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-small font-semibold whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
