import { useEffect, useState } from 'react';
import type { CodeLevel } from '@shared/settings';
import type { StepDiffOutput, StepFileVM, StepVM } from '@shared/ipc';
import { Button } from '../../components/Button';
import { CodeLevelSwitch } from '../../components/CodeLevelSwitch';
import { Dialog } from '../../components/Dialog';
import { DiffBlock } from '../../components/DiffBlock';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface StepCodeTabProps {
  readonly step: StepVM | null;
  readonly projectId: string;
  readonly defaultLevel?: CodeLevel;
  readonly onAskSnippet?: (snippet: string) => void;
  readonly onDirectEditClick?: () => void;
  readonly onStepUndone?: (stepId: string) => void;
  readonly onStepRedone?: (stepId: string) => void;
}

export function StepCodeTab({
  step,
  projectId: _projectId,
  defaultLevel = 'summary',
  onAskSnippet,
  onDirectEditClick,
  onStepUndone,
  onStepRedone,
}: StepCodeTabProps): React.JSX.Element {
  const bridge = getBridge();
  const [level, setLevel] = useState<CodeLevel>(defaultLevel);
  const [diffData, setDiffData] = useState<StepDiffOutput | null>(null);
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (step) {
      void bridge.code.stepDiff(step.id).then((res) => {
        if (mounted && res.ok) {
          setDiffData(res.data);
          setSelectedFileIdx(0);
        }
      });
    } else {
      setDiffData(null);
    }
    return () => {
      mounted = false;
    };
  }, [bridge, step]);

  if (!step) {
    return (
      <div className="p-6 text-center text-small text-muted flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl">📋</span>
        <p>{t('mh03.codeNotRunNotice')}</p>
      </div>
    );
  }

  const files: StepFileVM[] = diffData?.files ?? [];
  const activeFile = files[selectedFileIdx] ?? files[0];

  const handleConfirmUndo = async (): Promise<void> => {
    setIsUndoing(true);
    try {
      const res = await bridge.checkpoints.undoStep(step.id);
      if (res.ok) {
        setIsUndoModalOpen(false);
        onStepUndone?.(step.id);
      }
    } finally {
      setIsUndoing(false);
    }
  };

  const handleRedo = async (): Promise<void> => {
    const res = await bridge.checkpoints.redoStep(step.id);
    if (res.ok) {
      onStepRedone?.(step.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-2/20 overflow-y-auto">
      {/* HEADER CỦA BƯỚC */}
      <div className="p-4 bg-surface border-b border-border flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-eyebrow uppercase font-bold text-muted">
                {t('mh03.stepNumber', { seq: step.seq.toString() })}
              </span>
              <Pill tone={step.status === 'done' ? 'ok' : 'wait'} className="text-[11px] py-0">
                {t(`mh03.status.${step.status}`)}
              </Pill>
              {step.riskLevel === 'high' && (
                <Pill tone="danger" className="text-[11px] py-0">
                  {t('mh03.stepRiskLabel')}
                </Pill>
              )}
            </div>
            <h3 className="text-body font-bold text-cf-text leading-snug">{step.title}</h3>
          </div>
        </div>

        <div className="flex items-center justify-between text-tiny text-muted">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: step.agentColor }}
              aria-hidden="true"
            />
            {step.agentLabel} {step.modelLabel ? `· ${step.modelLabel}` : ''}
          </span>

          <CodeLevelSwitch level={level} onChange={setLevel} />
        </div>

        {/* PILLS FILE ĐÃ ĐỔI */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-eyebrow uppercase font-semibold text-muted text-[11px]">
              {t('mh03.code.changedFiles')}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {files.map((file, idx) => (
                <button
                  key={file.id}
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-[12px] font-mono border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedFileIdx === idx
                      ? 'bg-primary-soft text-primary border-primary font-medium'
                      : 'bg-surface text-cf-text border-border hover:bg-surface-2'
                  }`}
                  onClick={() => {
                    setSelectedFileIdx(idx);
                    setLevel('full');
                  }}
                >
                  <span
                    className={
                      file.change === 'added'
                        ? 'text-ok-ink'
                        : file.change === 'deleted'
                          ? 'text-danger-ink'
                          : 'text-warn-ink'
                    }
                  >
                    {file.change === 'added' ? '+' : file.change === 'deleted' ? '−' : '✎'}
                  </span>
                  <span>{file.path}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BODY THEO MỨC XEM CODE */}
      <div className="p-4 flex-1 flex flex-col gap-4">
        {level === 'summary' && (
          <div className="bg-surface border border-border rounded-card p-4 shadow-sm flex flex-col gap-3">
            <p className="text-small text-cf-text leading-relaxed">
              {diffData?.summary ?? step.title}
            </p>
            {diffData?.whyApproach && (
              <div className="bg-surface-2/60 border border-border rounded-lg p-3 text-small">
                <div className="text-eyebrow uppercase font-bold text-muted text-[11px] mb-1">
                  {t('mh03.code.whyBoxTitle')}
                </div>
                <p className="text-cf-text leading-relaxed">{diffData.whyApproach}</p>
              </div>
            )}
          </div>
        )}

        {level === 'diff' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-small text-muted font-medium">
              <span>
                {t('mh03.code.mainChange')} · {activeFile?.path ?? 'tất cả file'}
              </span>
            </div>

            <DiffBlock
              diffText={activeFile?.diffSummary ?? diffData?.fullDiff ?? '+ // Chưa có diff'}
              maxLines={15}
              onAskSnippet={onAskSnippet}
            />

            {diffData?.summary && (
              <div className="bg-surface border border-border rounded-lg p-3 text-small flex flex-col gap-1">
                <span className="text-eyebrow uppercase font-bold text-muted text-[11px]">
                  {t('mh03.code.shortExplanation')}
                </span>
                <p className="text-cf-text leading-relaxed">{diffData.summary}</p>
              </div>
            )}
          </div>
        )}

        {level === 'full' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-small font-mono font-medium text-cf-text">
                {activeFile?.path ?? 'diff.patch'}
              </span>
              {onDirectEditClick && (
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border bg-surface text-small font-medium text-cf-text hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  onClick={onDirectEditClick}
                >
                  <span>{t('mh03.code.directEditBtn')}</span>
                </button>
              )}
            </div>

            <DiffBlock
              diffText={activeFile?.fullDiff ?? diffData?.fullDiff ?? '// Không có thay đổi'}
              onAskSnippet={onAskSnippet}
            />
          </div>
        )}

        {/* NÚT HOÀN TÁC HOẶC LÀM LẠI BƯỚC */}
        <div className="mt-auto pt-4 border-t border-line flex items-center justify-between">
          {step.status === 'done' ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-tiny text-muted">{t('mh03.code.undoHint')}</span>
              <Button
                variant="default"
                size="sm"
                className="text-danger hover:text-danger-ink border-border cursor-pointer"
                onClick={() => setIsUndoModalOpen(true)}
              >
                {t('mh03.code.undoBtn')}
              </Button>
            </div>
          ) : step.status === 'undone' ? (
            <div className="flex items-center justify-between w-full bg-warn-bg/40 border border-warn-border p-3 rounded-lg">
              <span className="text-small text-warn-ink font-medium">
                {t('mh03.code.undoneNotice')}
              </span>
              <Button variant="primary" size="sm" onClick={() => void handleRedo()}>
                {t('mh03.code.redoBtn')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* DIALOG XÁC NHẬN HOÀN TÁC */}
      <Dialog
        open={isUndoModalOpen}
        title={t('mh03.code.undoConfirmTitle')}
        subtitle={t('mh03.code.undoConfirmDesc', { seq: step.seq.toString() })}
        tone="warn"
        iconSymbol="↶"
        onClose={() => setIsUndoModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              type="button"
              className="px-4 py-2 rounded-md border border-border bg-surface text-small font-medium text-cf-text hover:bg-surface-2 transition-colors cursor-pointer"
              onClick={() => setIsUndoModalOpen(false)}
            >
              {t('mh03.code.undoConfirmNo')}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-warn text-small font-medium text-white hover:bg-warn/90 transition-colors cursor-pointer"
              disabled={isUndoing}
              onClick={() => void handleConfirmUndo()}
            >
              {isUndoing ? 'Đang hoàn tác…' : t('mh03.code.undoConfirmYes')}
            </button>
          </div>
        }
      >
        <p className="text-small text-cf-text leading-relaxed">
          File của bạn sẽ được hoàn tác về trạng thái tại checkpoint trước bước {step.seq}. Bạn vẫn
          có thể làm lại bước này sau.
        </p>
      </Dialog>
    </div>
  );
}
