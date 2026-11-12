import { t } from '../i18n';

export interface ProjectPillProps {
  readonly name: string;
  readonly path: string;
  readonly onClick?: () => void;
}

export function truncateMiddlePath(rawPath: string, maxLength = 34): string {
  const normalized = rawPath.replace(/\\/g, '/');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 2) {
    const keep = Math.floor((maxLength - 3) / 2);
    return `${normalized.slice(0, keep)}…${normalized.slice(-keep)}`;
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  const candidate = `${first}/…/${secondLast}/${last}`;
  return candidate.length <= maxLength ? candidate : `${first}/…/${last}`;
}

export function ProjectPill({ name, path, onClick }: ProjectPillProps): React.JSX.Element {
  const shortPath = truncateMiddlePath(path);
  const content = (
    <>
      <span aria-hidden="true" className="text-primary-ink font-bold">
        $
      </span>
      <span className="text-text font-semibold">{name}</span>
      <span aria-hidden="true" className="text-muted">
        ·
      </span>
      <span className="font-mono text-[11px] text-muted">{shortPath}</span>
      {onClick ? (
        <span aria-hidden="true" className="text-muted text-[10px]">
          ▾
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        title={`${t('app.header.switchProjectTitle')}: ${path}`}
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border rounded-btn text-[12px] font-mono text-muted bg-bg/70 hover:bg-surface-2 hover:border-primary/40 transition-colors"
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={path}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border rounded-btn text-[12px] font-mono text-muted bg-bg/70"
    >
      {content}
    </span>
  );
}
