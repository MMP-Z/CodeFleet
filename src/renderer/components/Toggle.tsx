export interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (nextChecked: boolean) => void;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly id?: string;
}

/**
 * Bộ chuyển chuẩn khả năng truy cập (role="switch" + aria-checked theo UI_SPEC MH-11).
 */
export function Toggle({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  id,
}: ToggleProps): React.JSX.Element {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-pill border-0 shrink-0 transition-colors ${
        checked ? 'bg-primary' : 'bg-dashed'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-pill bg-surface transition-transform duration-150 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

