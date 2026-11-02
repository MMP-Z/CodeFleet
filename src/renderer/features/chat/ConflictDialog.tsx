import { useState } from 'react';
import type { ConflictResolutionChoice, FileConflictVM } from '@shared/ipc';
import { Dialog } from '../../components/Dialog';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';

export interface ConflictDialogProps {
  readonly conflict: FileConflictVM | null;
  readonly onResolve: (choice: ConflictResolutionChoice) => void;
  readonly onClose: () => void;
}

export function ConflictDialog({
  conflict,
  onResolve,
  onClose,
}: ConflictDialogProps): React.JSX.Element | null {
  const [choice, setChoice] = useState<ConflictResolutionChoice>('keep_user_ask_ai');

  if (!conflict) return null;

  return (
    <Dialog
      open={true}
      title={t('mh05.title')}
      subtitle={`${t('mh05.subtitle')} · ${conflict.filePath}`}
      tone="warn"
      iconSymbol="⚡"
      onClose={onClose}
      onEscape={onClose}
      footer={
        <div className="flex justify-between items-center w-full">
          <button
            type="button"
            className="text-small text-muted hover:text-cf-text underline cursor-pointer"
            onClick={onClose}
          >
            {t('mh05.postpone')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-primary text-small font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer"
              onClick={() => onResolve(choice)}
            >
              {t('mh05.confirmChoice')}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-small text-cf-text">
        {/* LỜI GIẢI THÍCH NÓI ĐƠN GIẢN */}
        <div className="bg-warn-bg/50 border border-warn-border p-3 rounded-lg text-warn-ink flex flex-col gap-1">
          <span className="font-bold text-eyebrow uppercase tracking-wide">
            {t('mh05.plainExplainTitle')}
          </span>
          <p className="leading-relaxed text-[13px]">{conflict.plainExplain}</p>
        </div>

        {/* 2 CỘT SO SÁNH NỘI DUNG */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 border border-border rounded-lg p-3 bg-surface-2/40">
            <span className="font-bold text-cf-text text-[13px] flex items-center justify-between">
              <span>{t('mh05.colUser')}</span>
              <Pill tone="ok" className="text-[10px] py-0">
                {t('mh05.colUserBadge')}
              </Pill>
            </span>
            <div className="font-mono text-[12px] bg-surface p-2.5 rounded border border-line overflow-x-auto max-h-48 whitespace-pre leading-relaxed">
              {conflict.userVersion}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border border-border rounded-lg p-3 bg-surface-2/40">
            <span className="font-bold text-cf-text text-[13px] flex items-center justify-between">
              <span>{t('mh05.colAi')}</span>
              <Pill tone="wait" className="text-[10px] py-0">
                {t('mh05.colAiBadge')}
              </Pill>
            </span>
            <div className="font-mono text-[12px] bg-surface p-2.5 rounded border border-line overflow-x-auto max-h-48 whitespace-pre leading-relaxed">
              {conflict.aiVersion}
            </div>
          </div>
        </div>

        {/* 3 LỰA CHỌN RADIO */}
        <div className="flex flex-col gap-2.5 pt-1">
          <label
            className={`p-3 border rounded-lg cursor-pointer flex items-start gap-3 transition-colors ${
              choice === 'keep_user_ask_ai'
                ? 'border-primary bg-primary-soft/30'
                : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              name="conflictChoice"
              value="keep_user_ask_ai"
              checked={choice === 'keep_user_ask_ai'}
              onChange={() => setChoice('keep_user_ask_ai')}
              className="mt-1"
            />
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cf-text text-[13px]">{t('mh05.opt1')}</span>
                <Pill tone="brand" className="text-[10px] py-0">
                  {t('mh05.opt1Badge')}
                </Pill>
              </div>
              <span className="text-[12px] text-muted">{t('mh05.opt1Desc')}</span>
            </div>
          </label>

          <label
            className={`p-3 border rounded-lg cursor-pointer flex items-start gap-3 transition-colors ${
              choice === 'keep_user'
                ? 'border-primary bg-primary-soft/30'
                : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              name="conflictChoice"
              value="keep_user"
              checked={choice === 'keep_user'}
              onChange={() => setChoice('keep_user')}
              className="mt-1"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-cf-text text-[13px]">{t('mh05.opt2')}</span>
              <span className="text-[12px] text-muted">{t('mh05.opt2Desc')}</span>
            </div>
          </label>

          <label
            className={`p-3 border rounded-lg cursor-pointer flex items-start gap-3 transition-colors ${
              choice === 'use_ai'
                ? 'border-primary bg-primary-soft/30'
                : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              name="conflictChoice"
              value="use_ai"
              checked={choice === 'use_ai'}
              onChange={() => setChoice('use_ai')}
              className="mt-1"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-cf-text text-[13px]">{t('mh05.opt3')}</span>
              <span className="text-[12px] text-muted">{t('mh05.opt3Desc')}</span>
            </div>
          </label>
        </div>
      </div>
    </Dialog>
  );
}
