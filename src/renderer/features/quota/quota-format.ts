import type { QuotaSnapshot } from '@shared/ipc';
import { t } from '../../i18n';

export interface QuotaChipSummary {
  readonly text: string;
  readonly tone: 'ok' | 'low' | 'exhausted' | 'unknown';
}

/**
 * Định dạng tóm tắt hiển thị trên QuotaChip theo UI_SPEC 3.2 & PLAN 6.6:
 * - scope = shared / unknown: "{max usedPercent}%", thêm " · ước lượng" nếu source = estimated.
 * - scope = model: liệt kê model khác ok (ví dụ "Pro hết · Flash 23%"). Tối đa 2 model; nếu > 2 model -> "X/Y model hết".
 * - Hết tất cả: "Đã hết".
 * - Màu chip: hết tất cả -> danger ('exhausted'); có model low/exhausted nhưng còn model dùng được -> warn ('low'); tất cả ok -> 'ok'.
 */
export function formatQuotaChipSummary(
  agentId: string,
  snapshots: readonly QuotaSnapshot[],
): QuotaChipSummary {
  const agentSnapshots = snapshots.filter((s) => s.agentId === agentId);

  if (agentSnapshots.length === 0) {
    return {
      text: t('mh03.quota.unknown'),
      tone: 'unknown',
    };
  }

  // Trường hợp scope = model
  const hasModelScope = agentSnapshots.some((s) => s.scope === 'model');

  if (hasModelScope) {
    const totalModels = agentSnapshots.length;
    const exhaustedModels = agentSnapshots.filter((s) => s.status === 'exhausted');
    const nonOkModels = agentSnapshots.filter(
      (s) => s.status === 'exhausted' || s.status === 'low',
    );

    // Tất cả model đều hết
    if (exhaustedModels.length === totalModels) {
      return {
        text: t('mh03.quota.allExhausted'),
        tone: 'exhausted',
      };
    }

    // Tất cả model đều ok
    if (nonOkModels.length === 0) {
      const maxUsed = Math.max(
        0,
        ...agentSnapshots.flatMap((s) => s.windows.map((w) => w.usedPercent ?? 0)),
      );
      return {
        text: `${maxUsed}%`,
        tone: 'ok',
      };
    }

    // Nếu có hơn 2 model bị ảnh hưởng -> "X/Y model hết" hoặc "X/Y model sắp hết"
    if (nonOkModels.length > 2) {
      const count = exhaustedModels.length > 0 ? exhaustedModels.length : nonOkModels.length;
      return {
        text: `${count}/${totalModels} ${t('mh03.quota.modelsExhausted')}`,
        tone: 'low',
      };
    }

    // Tối đa 2 model: liệt kê model khác ok (kèm model ok còn lại nếu có)
    const parts: string[] = [];
    for (const snap of agentSnapshots) {
      const modelName = snap.model
        ? snap.model.replace(/^[a-z0-9]+-/, '')
        : 'Model';
      const shortName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

      if (snap.status === 'exhausted') {
        parts.push(`${shortName} ${t('mh03.quota.exhaustedSuffix')}`);
      } else if (snap.status === 'low') {
        const maxUsed = Math.max(0, ...snap.windows.map((w) => w.usedPercent ?? 0));
        parts.push(`${shortName} ${maxUsed}%`);
      } else if (parts.length < 2) {
        // Model còn dùng được
        const maxUsed = Math.max(0, ...snap.windows.map((w) => w.usedPercent ?? 0));
        parts.push(`${shortName} ${maxUsed}%`);
      }
    }

    return {
      text: parts.slice(0, 2).join(' · '),
      tone: 'low',
    };
  }

  // Trường hợp scope = shared hoặc unknown
  const snap = agentSnapshots[0]!;
  if (snap.status === 'unknown' || snap.windows.length === 0) {
    return {
      text: t('mh03.quota.unknown'),
      tone: 'unknown',
    };
  }

  if (snap.status === 'exhausted') {
    return {
      text: t('mh03.quota.allExhausted'),
      tone: 'exhausted',
    };
  }

  const maxUsed = Math.max(0, ...snap.windows.map((w) => w.usedPercent ?? 0));
  let text = `${maxUsed}%`;
  if (snap.source === 'estimated') {
    text += ` · ${t('mh03.quota.estimatedSuffix')}`;
  }

  return {
    text,
    tone: snap.status === 'low' ? 'low' : 'ok',
  };
}
