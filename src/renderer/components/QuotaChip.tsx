import React from 'react';
import type { QuotaSource, QuotaStatus } from '@shared/ipc';

export interface QuotaChipProps {
  readonly agentId: string;
  readonly label: string;
  readonly color?: string;
  readonly text: string;
  readonly tone: QuotaStatus;
  readonly source?: QuotaSource;
  readonly onClick?: () => void;
  readonly isActive?: boolean;
}

/**
 * Chip hiển thị hạn mức của một AI trên thanh AppHeader theo UI_SPEC 3.2, 4.0.
 */
export function QuotaChip({
  label,
  color = '#10A37F',
  text,
  tone,
  onClick,
  isActive = false,
}: QuotaChipProps): React.JSX.Element {
  let toneClasses = 'bg-surface border-border text-text hover:bg-surface-2';

  switch (tone) {
    case 'low':
      toneClasses = 'bg-warn-soft border-warn/40 text-warn-ink font-medium hover:bg-warn-soft/80';
      break;
    case 'exhausted':
      toneClasses =
        'bg-danger-soft border-danger/40 text-danger-ink font-semibold hover:bg-danger-soft/80';
      break;
    case 'unknown':
      toneClasses = 'bg-surface-2 border-border text-muted hover:bg-surface';
      break;
    case 'ok':
    default:
      toneClasses = 'bg-surface border-border text-text hover:bg-surface-2';
      break;
  }

  const activeRing = isActive ? 'ring-2 ring-primary/40' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isActive}
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs border rounded-pill transition-all cursor-pointer select-none ${toneClasses} ${activeRing}`}
      title={`${label}: ${text}`}
    >
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="font-semibold text-text">{label}</span>
      <span className="text-[11px] opacity-90">{text}</span>
    </button>
  );
}
