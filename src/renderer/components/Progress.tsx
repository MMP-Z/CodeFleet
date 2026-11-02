export type ProgressTone = 'ok' | 'low' | 'out' | 'brand';

export interface ProgressProps {
  readonly value: number;
  readonly tone?: ProgressTone;
  readonly thin?: boolean;
  readonly ariaLabel?: string;
  readonly className?: string;
}

const BAR_CLASSES: Record<ProgressTone, string> = {
  ok: 'bg-bar-ok',
  low: 'bg-bar-low',
  out: 'bg-danger',
  brand: 'bg-primary',
};

export function Progress({
  value,
  tone = 'ok',
  thin = false,
  ariaLabel,
  className = '',
}: ProgressProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={`${thin ? 'h-1.5' : 'h-2'} rounded-[4px] bg-line overflow-hidden ${className}`.trim()}
    >
      <div
        className={`h-full rounded-[4px] transition-all ${BAR_CLASSES[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
