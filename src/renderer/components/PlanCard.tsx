import type { StepVM } from '@shared/ipc';
import { t } from '../i18n';
import { StepRow } from './StepRow';

export interface PlanCardProps {
  readonly steps: StepVM[];
  readonly activeStepId?: string | null;
  readonly onViewCode?: (stepId: string) => void;
}

export function PlanCard({ steps, activeStepId, onViewCode }: PlanCardProps): React.JSX.Element {
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden my-3 shadow-sm">
      <div className="p-3.5 bg-surface-2/40 border-b border-line">
        <div className="flex items-center justify-between text-eyebrow uppercase font-bold text-muted">
          <span>{t('mh03.planTitle')}</span>
          <span>
            {t('mh03.planProgress', {
              done: doneCount.toString(),
              total: totalCount.toString(),
            })}
          </span>
        </div>
        <div className="w-full h-1.5 bg-line rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-line">
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            isActive={activeStepId === step.id}
            onViewCode={onViewCode}
          />
        ))}
      </div>
    </div>
  );
}
