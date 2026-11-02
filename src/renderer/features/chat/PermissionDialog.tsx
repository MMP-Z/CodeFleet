import { Dialog } from '../../components/Dialog';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';

export interface PermissionRequestData {
  readonly conversationId: string;
  readonly requestId: string;
  readonly stepSeq: number;
  readonly agentLabel: string;
  readonly modelLabel: string;
  readonly actionTitle: string;
  readonly description: string;
  readonly impactSummary?: {
    network?: string;
    command?: string;
    file?: string;
  };
  readonly exactCommand?: string;
}

export interface PermissionDialogProps {
  readonly request: PermissionRequestData | null;
  readonly onRespond: (granted: boolean) => void;
}

export function PermissionDialog({
  request,
  onRespond,
}: PermissionDialogProps): React.JSX.Element | null {
  if (!request) return null;

  return (
    <Dialog
      open={true}
      title={t('mh04.titleAction', { action: request.actionTitle })}
      subtitle={t('mh04.stepContext', {
        agent: request.agentLabel,
        model: request.modelLabel,
        seq: request.stepSeq.toString(),
      })}
      tone="warn"
      iconSymbol="!"
      onClose={() => onRespond(false)}
      onEscape={() => onRespond(false)}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-border bg-surface text-small font-medium text-cf-text hover:bg-surface-2 transition-colors cursor-pointer"
            onClick={() => onRespond(false)}
          >
            {t('mh04.deny')}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-primary text-small font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer"
            onClick={() => onRespond(true)}
          >
            {t('mh04.allowOnce')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-small text-cf-text">
        <p className="leading-relaxed">{request.description}</p>

        {request.impactSummary && (
          <div className="bg-surface-2/60 border border-border rounded-lg overflow-hidden">
            <div className="px-3.5 py-2 border-b border-line text-eyebrow uppercase font-bold text-muted">
              {t('mh04.whatItDoes')}
            </div>
            <div className="p-3.5 flex flex-col gap-2">
              {request.impactSummary.network && (
                <div className="flex items-start gap-2.5">
                  <Pill tone="warn" className="flex-none text-[11px]">
                    {t('mh04.tagNetwork')}
                  </Pill>
                  <span className="text-[13px]">{request.impactSummary.network}</span>
                </div>
              )}
              {request.impactSummary.command && (
                <div className="flex items-start gap-2.5">
                  <Pill tone="warn" className="flex-none text-[11px]">
                    {t('mh04.tagCommand')}
                  </Pill>
                  <span className="text-[13px]">{request.impactSummary.command}</span>
                </div>
              )}
              {request.impactSummary.file && (
                <div className="flex items-start gap-2.5">
                  <Pill tone="run" className="flex-none text-[11px]">
                    {t('mh04.tagFile')}
                  </Pill>
                  <span className="text-[13px]">{request.impactSummary.file}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {request.exactCommand && (
          <details className="text-[12px] text-muted">
            <summary className="cursor-pointer text-primary hover:underline">
              {t('mh04.exactCommand')}
            </summary>
            <div className="mt-2 p-2.5 bg-cf-bg border border-border rounded font-mono text-cf-text">
              <span className="text-muted mr-2">$</span>
              {request.exactCommand}
            </div>
          </details>
        )}

        <div className="p-3 bg-surface-2/40 border border-border rounded-md text-[12px] text-muted leading-relaxed">
          ℹ {t('mh04.safeGuarantee')}
        </div>
      </div>
    </Dialog>
  );
}
