import type { StepVM } from '@shared/ipc';
import { t } from '../i18n';
import { Button } from './Button';
import { Pill, type PillTone } from './Pill';

export interface StepRowProps {
  readonly step: StepVM;
  readonly isActive?: boolean;
  readonly onViewCode?: (stepId: string) => void;
}

export function StepRow({ step, isActive = false, onViewCode }: StepRowProps): React.JSX.Element {
  let statusTone: PillTone = 'wait';
  let statusLabel = t('mh03.status.pending');

  switch (step.status) {
    case 'done':
      statusTone = 'ok';
      statusLabel = t('mh03.status.done');
      break;
    case 'running':
      statusTone = 'run';
      statusLabel = t('mh03.status.running');
      break;
    case 'paused':
      statusTone = 'warn';
      statusLabel = t('mh03.status.paused');
      break;
    case 'waiting_permission':
      statusTone = 'warn';
      statusLabel = t('mh03.status.ask');
      break;
    case 'failed':
      statusTone = 'danger';
      statusLabel = t('mh03.status.failed');
      break;
    case 'undone':
      statusTone = 'wait';
      statusLabel = t('mh03.status.undone');
      break;
    case 'pending':
    default:
      statusTone = 'wait';
      statusLabel = t('mh03.status.pending');
      break;
  }

  const modelText = step.modelLabel ? ` · ${step.modelLabel}` : '';

  return (
    <div
      className={`flex items-start md:items-center gap-3 p-3.5 border-t border-line transition-colors ${
        isActive ? 'bg-primary-row' : 'hover:bg-surface-2'
      }`}
    >
      <div className="flex-none w-6 h-6 rounded-full bg-surface-2 text-center text-small font-bold text-muted flex items-center justify-center">
        {step.seq}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-small font-semibold text-cf-text mb-0.5">{step.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5 font-medium text-cf-text">
            <span
              className="w-2 h-2 rounded-full inline-block flex-none"
              style={{ backgroundColor: step.agentColor }}
              aria-hidden="true"
            />
            {step.agentLabel}
            {modelText}
          </span>

          {step.note && <span className="text-muted italic">{step.note}</span>}

          {step.riskLevel === 'high' && (
            <Pill tone="warn" className="text-[11px] py-0 font-semibold">
              {step.riskText ?? t('mh03.stepRiskLabel')}
            </Pill>
          )}
        </div>
      </div>

      <div className="flex-none flex items-center gap-2">
        <Pill tone={statusTone} className="text-[11px]">
          {statusLabel}
        </Pill>
        {(step.hasCode || step.status === 'done' || step.status === 'running') && onViewCode && (
          <Button type="button" variant="default" size="sm" onClick={() => onViewCode(step.id)}>
            {t('mh03.viewCode')}
          </Button>
        )}
      </div>
    </div>
  );
}
