import type { OrchestrationLogEntry } from '@shared/ipc';
import { t } from '../../i18n';

export interface DecisionReason {
  readonly title: string;
  readonly reason: string;
}

export interface OrchestrationLogProps {
  readonly reasons: DecisionReason[];
  readonly logEntries: OrchestrationLogEntry[];
}

export function OrchestrationLog({
  reasons,
  logEntries,
}: OrchestrationLogProps): React.JSX.Element {
  const getWhoClass = (source: string): string => {
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash + source.charCodeAt(i)) % 4;
    }
    const colors = ['text-primary', 'text-[#C2603A]', 'text-[#10A37F]', 'text-[#1A73E8]'];
    return `${colors[hash]} font-semibold`;
  };

  return (
    <div className="flex flex-col gap-4 text-small text-cf-text">
      {/* VÌ SAO CHỌN AI VÀ MODEL NÀY */}
      <div className="bg-surface border border-border rounded-card p-4 shadow-sm flex flex-col gap-3">
        <div className="text-eyebrow uppercase font-bold text-muted border-b border-line pb-2">
          {t('mh03.detail.reasonsTitle')}
        </div>
        {reasons.length === 0 ? (
          <div className="text-muted text-small">{t('mh03.detail.emptyReasons')}</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reasons.map((r, idx) => (
              <div key={idx} className="p-2.5 rounded-md bg-surface-2/40 border border-border">
                <div className="font-semibold text-cf-text mb-1">{r.title}</div>
                <div className="text-[13px] text-muted leading-relaxed">{r.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NHẬT KÝ TRỰC TIẾP */}
      <div className="bg-surface border border-border rounded-card p-4 shadow-sm flex flex-col gap-3 font-mono text-[12px]">
        <div className="text-eyebrow uppercase font-bold text-muted border-b border-line pb-2 font-sans">
          {t('mh03.detail.logTitle')}
        </div>
        {logEntries.length === 0 ? (
          <div className="text-muted text-small font-sans">{t('mh03.detail.emptyLog')}</div>
        ) : (
          <div className="flex flex-col divide-y divide-line/60 max-h-96 overflow-y-auto">
            {logEntries.map((log, idx) => (
              <div key={idx} className="py-1.5 flex items-start gap-2.5">
                <span className="text-muted flex-none">{log.at}</span>
                <span className={`flex-none ${getWhoClass(log.source)}`}>[{log.source}]</span>
                <span className="text-cf-text flex-1 break-words">{log.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[12px] text-muted leading-relaxed px-1">{t('mh03.detail.hint')}</div>
    </div>
  );
}
