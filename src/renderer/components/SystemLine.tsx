export interface SystemLineProps {
  readonly text: string;
  readonly tone?: 'info' | 'warn' | 'neutral';
}

export function SystemLine({ text, tone = 'info' }: SystemLineProps): React.JSX.Element {
  const toneClasses =
    tone === 'warn'
      ? 'border-warn-ink/20 text-warn-ink bg-warn-bg/40'
      : 'border-border text-muted bg-surface-2/60';

  return (
    <div
      className={`my-3 px-3 py-2 border rounded-md text-[13px] leading-relaxed transition-all ${toneClasses}`}
    >
      <span className="font-medium mr-1.5" aria-hidden="true">
        ℹ
      </span>
      <span>{text}</span>
    </div>
  );
}
