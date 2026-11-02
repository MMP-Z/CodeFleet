import React, { useEffect, useRef } from 'react';
import type { QuotaSnapshot } from '@shared/ipc';
import { t } from '../i18n';
import { Pill } from './Pill';
import { Progress } from './Progress';

export interface QuotaPopoverProps {
  readonly agentId: string;
  readonly agentLabel: string;
  readonly snapshots: readonly QuotaSnapshot[];
  readonly onClose: () => void;
  readonly onViewAll: () => void;
}

/**
 * Hộp thông tin chi tiết hạn mức mở ra khi bấm chip trên header (UI_SPEC 5.3.1).
 */
export function QuotaPopover({
  agentLabel,
  snapshots,
  onClose,
  onViewAll,
}: QuotaPopoverProps): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Xử lý click outside và phím Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (snapshots.length === 0) {
    return (
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="false"
        className="absolute right-0 top-full mt-2 w-80 p-4 bg-surface border border-border rounded-card shadow-lg z-50 text-sm"
      >
        <p className="text-muted">{t('mh03.quota.unknown')}</p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs border border-border rounded-btn bg-surface hover:bg-surface-2"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    );
  }

  const primarySnap = snapshots[0]!;
  const scope = primarySnap.scope;
  const isModelScope = scope === 'model';

  // Lấy thời gian cập nhật
  const capturedDate = new Date(primarySnap.capturedAt);
  const updatedTime = !isNaN(capturedDate.getTime())
    ? capturedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  // Chuyển đổi nhãn và pill nguồn
  let sourcePill: { tone: 'ok' | 'warn' | 'danger' | 'wait'; label: string } = {
    tone: 'wait',
    label: t('mh08.unknown'),
  };
  if (primarySnap.source === 'official') {
    sourcePill = { tone: 'ok', label: t('mh08.official') };
  } else if (primarySnap.source === 'estimated') {
    sourcePill = { tone: 'warn', label: t('mh08.estimated') };
  } else if (primarySnap.source === 'detected') {
    sourcePill = { tone: 'danger', label: t('mh08.detected') };
  }

  // Câu phạm vi
  let scopeText = t('mh03.quota.scopeShared');
  if (isModelScope) {
    scopeText = t('mh03.quota.scopeModel');
  } else if (scope === 'unknown') {
    scopeText = t('mh03.quota.scopeUnknown');
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t('mh03.quota.popoverTitle', { name: agentLabel })}
      className="absolute right-0 top-full mt-2 w-84 p-4 bg-surface border border-border rounded-card shadow-xl z-50 text-sm flex flex-col gap-3"
    >
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h4 className="font-semibold text-text text-base">{agentLabel}</h4>
        <div className="flex items-center gap-1.5">
          <Pill tone={sourcePill.tone}>{sourcePill.label}</Pill>
        </div>
      </div>

      <div className="text-xs text-muted flex items-center justify-between">
        <span>{scopeText}</span>
        {primarySnap.plan ? (
          <span className="font-medium text-text">{primarySnap.plan}</span>
        ) : null}
      </div>

      {/* Hiển thị thanh tiến độ các cửa sổ */}
      {!isModelScope ? (
        <div className="flex flex-col gap-2.5 my-1">
          {primarySnap.windows.map((win, idx) => {
            const usedPercent = win.usedPercent ?? 0;
            let winTone: 'ok' | 'low' | 'out' = 'ok';
            if (usedPercent >= 100) winTone = 'out';
            else if (usedPercent >= 80) winTone = 'low';

            const resetsAtStr = win.resetsAt
              ? new Date(win.resetsAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;

            return (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text font-medium">{win.label}</span>
                  <span className="font-bold text-text">{usedPercent}%</span>
                </div>
                <Progress value={usedPercent} tone={winTone} />
                {resetsAtStr ? (
                  <span className="text-[11px] text-muted self-end">
                    {t('mh03.quota.resetsAt', { time: resetsAtStr })}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2 my-1 max-h-48 overflow-y-auto">
          {snapshots.map((snap, idx) => {
            const modelName = snap.model
              ? snap.model.replace(/^[a-z0-9]+-/, '')
              : `Model ${idx + 1}`;
            const maxUsed = Math.max(0, ...snap.windows.map((w) => w.usedPercent ?? 0));
            let modelTone: 'ok' | 'low' | 'out' = 'ok';
            if (snap.status === 'exhausted' || maxUsed >= 100) modelTone = 'out';
            else if (snap.status === 'low' || maxUsed >= 80) modelTone = 'low';

            return (
              <div key={idx} className="flex flex-col gap-1 p-2 bg-surface-2 rounded-btn">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text">{modelName}</span>
                  <span className="font-bold text-text">
                    {snap.status === 'exhausted' ? t('mh03.quota.allExhausted') : `${maxUsed}%`}
                  </span>
                </div>
                <Progress value={maxUsed} tone={modelTone} thin />
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
        <span className="text-muted">{t('mh03.quota.updatedAt', { time: updatedTime })}</span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onViewAll();
          }}
          className="text-primary hover:underline font-medium cursor-pointer"
        >
          {t('mh03.quota.seeAll')}
        </button>
      </div>
    </div>
  );
}
