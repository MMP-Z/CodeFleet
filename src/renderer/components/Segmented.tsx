export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (nextValue: T) => void;
  readonly ariaLabel?: string;
  readonly className?: string;
}

/**
 * Nhóm nút chọn mức dùng aria-pressed theo UI_SPEC 1.1.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex gap-1 p-[3px] bg-line rounded-input ${className}`.trim()}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={active}
            onClick={() => {
              if (!active) {
                onChange(option.value);
              }
            }}
            className={`flex-1 min-h-[34px] px-2.5 py-[5px] border-0 rounded-btn text-[13px] transition-all ${
              active
                ? 'bg-surface text-primary font-bold shadow-tab'
                : 'bg-transparent text-text hover:bg-surface/60'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
