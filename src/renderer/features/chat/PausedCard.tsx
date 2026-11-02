import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';

export interface PausedAgentQuotaStatus {
  readonly agentId: string;
  readonly displayName: string;
  readonly statusText: string;
  readonly isFastTierOnly?: boolean;
  readonly color?: string;
}

export interface PausedCardProps {
  readonly stepSeq: number;
  readonly quotaStatuses?: PausedAgentQuotaStatus[];
  readonly earliestResetTime?: string;
  readonly earliestResetAgent?: string;
  readonly onRetry: () => void;
  readonly onPickOtherAgent?: () => void;
}

export function PausedCard({
  stepSeq,
  quotaStatuses,
  earliestResetTime,
  earliestResetAgent,
  onRetry,
  onPickOtherAgent,
}: PausedCardProps): React.JSX.Element {
  const defaultStatuses: PausedAgentQuotaStatus[] = quotaStatuses ?? [
    {
      agentId: 'claude',
      displayName: 'Claude',
      statusText: t('mh07.statusExhausted', { time: '22:40' }),
      color: '#C2603A',
    },
    {
      agentId: 'codex',
      displayName: 'Codex',
      statusText: t('mh07.statusExhausted', { time: '23:15' }),
      color: '#10A37F',
    },
    {
      agentId: 'gemini',
      displayName: 'Gemini Pro',
      statusText: t('mh07.statusExhausted', { time: '00:00' }),
      color: '#1A73E8',
    },
    {
      agentId: 'gemini',
      displayName: 'Gemini Flash',
      statusText: t('mh07.statusAvailableFast', { percent: '77' }),
      isFastTierOnly: true,
      color: '#1A73E8',
    },
  ];

  return (
    <div className="bg-surface border border-warn-border rounded-card overflow-hidden my-4 shadow-sm">
      <div className="p-3.5 bg-warn-bg text-warn-ink font-bold text-small flex items-center gap-2">
        <span>{t('mh07.title', { seq: stepSeq.toString() })}</span>
      </div>

      <div className="p-4 flex flex-col gap-3.5 text-small text-cf-text">
        <p className="leading-relaxed">{t('mh07.explanation', { seq: stepSeq.toString() })}</p>

        <div className="bg-surface-2/40 border border-border rounded-lg p-3 flex flex-col gap-2">
          {defaultStatuses.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 font-medium">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: s.color ?? '#55625D' }}
                  aria-hidden="true"
                />
                {s.displayName}
              </span>
              <Pill tone={s.isFastTierOnly ? 'warn' : 'danger'} className="text-[11px] py-0">
                {s.statusText}
              </Pill>
            </div>
          ))}
        </div>

        {earliestResetTime && earliestResetAgent && (
          <div className="text-[12px] text-muted">
            {t('mh07.earliestResetHint', {
              time: earliestResetTime,
              agent: earliestResetAgent,
            })}
          </div>
        )}

        <div className="pt-2 border-t border-line flex flex-col gap-2">
          <div className="text-eyebrow uppercase font-bold text-muted">{t('mh07.youCan')}</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="md" onClick={onRetry}>
              {t('mh07.retryStep')}
            </Button>
            {onPickOtherAgent && (
              <Button type="button" variant="default" size="md" onClick={onPickOtherAgent}>
                {t('mh07.pinOther')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
