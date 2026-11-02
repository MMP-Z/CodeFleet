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
      <span>{name}</span>
      <span aria-hidden="true">·</span>
      <span className="font-mono text-small">{shortPath}</span>
      {onClick ? <span aria-hidden="true">▾</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        title={`${t('app.header.switchProjectTitle')}: ${path}`}
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1 border border-border rounded-pill text-[13px] text-muted bg-surface hover:bg-surface-2 transition-colors"
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={path}
      className="inline-flex items-center gap-1.5 px-3 py-1 border border-border rounded-pill text-[13px] text-muted bg-surface"
    >
      {content}
    </span>
  );
}
