import { useEffect, useState } from 'react';
import type { PreviewStatusOutput } from '@shared/ipc';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface PreviewTabProps {
  readonly projectId: string;
}

export function PreviewTab({ projectId }: PreviewTabProps): React.JSX.Element {
  const bridge = getBridge();
  const [status, setStatus] = useState<PreviewStatusOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function initPreview(): Promise<void> {
      setLoading(true);
      try {
        const startRes = await bridge.preview.start(projectId);
        if (!mounted) return;
        if (startRes.ok && startRes.data.ok) {
          setStatus({
            isWebProject: true,
            isRunning: true,
            url: startRes.data.url,
            error: null,
          });
        } else {
          setStatus({
            isWebProject: false,
            isRunning: false,
            url: null,
            error: startRes.ok ? (startRes.data.error ?? null) : startRes.error.message,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initPreview();
    return () => {
      mounted = false;
    };
  }, [bridge, projectId]);

  const handleRefresh = (): void => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = (): void => {
    if (status?.url) {
      window.open(status.url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-muted gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-small">{t('mh03.preview.starting')}</span>
      </div>
    );
  }

  if (!status?.isWebProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
        <span className="text-3xl">🌐</span>
        <h4 className="text-body font-bold text-cf-text">{t('mh03.preview.cannotPreview')}</h4>
        <p className="text-small text-muted max-w-sm leading-relaxed">
          {status?.error ?? t('mh03.preview.notWebProject')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border">
      {/* THANH ĐIỀU KHIỂN XEM TRƯỚC */}
      <div className="p-3 bg-surface-2/40 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-small">
          <Pill tone="ok" className="py-0.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block mr-1" />
            {t('mh03.preview.running')}
          </Pill>
          <span className="text-muted font-mono text-[12px] truncate max-w-[200px]">
            {status.url}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2.5 py-1 rounded border border-border bg-surface text-tiny font-medium text-cf-text hover:bg-surface-2 transition-colors cursor-pointer"
            onClick={handleRefresh}
          >
            {t('mh03.preview.refresh')}
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded border border-border bg-surface text-tiny font-medium text-cf-text hover:bg-surface-2 transition-colors cursor-pointer"
            onClick={handleOpenExternal}
          >
            {t('mh03.preview.openExternal')}
          </button>
        </div>
      </div>

      {/* KHUNG IFRAME CÁCH LY THEO ADR-021 */}
      <div className="flex-1 relative bg-white overflow-hidden">
        {status.url ? (
          <iframe
            key={iframeKey}
            src={status.url}
            title="CodeFleet Web Preview"
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="w-full h-full border-0 select-auto"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted text-small">
            Không có địa chỉ xem trước khả dụng
          </div>
        )}
      </div>

      <div className="p-2 bg-surface-2/60 border-t border-border text-center text-[11px] text-muted">
        {t('mh03.preview.sandboxNotice')}
      </div>
    </div>
  );
}
